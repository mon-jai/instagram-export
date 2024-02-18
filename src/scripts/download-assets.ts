import { existsSync } from "fs"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname, join, resolve } from "path"

import { ASSETS_PATH, REQUEST_HEADERS, VIEW_HTML_PATH, VIEW_HTML_SRC_PATH } from "../lib/constants.js"

type RegexResult = (RegExpMatchArray & { groups: { package: string; path?: string } })[]
type Asset = { url: string; path: string; content?: string | Buffer }
type FetchedAsset = Required<Asset>

const CDN_DOMAIN = String.raw`https:\/\/(?:(?:esm\.sh)|(?:rsms\.me))\/`
const IMPORT_EXPORT_PREFIX = String.raw`(?:import|from) *`
const PATH_PREFIX_TO_REMOVE = /(?:stable|v\d+)\//

// Fetch assets recursively
// Test with: https://esm.sh/antd@5.13.2
async function fetchAssets(htmlSrc: string) {
  const extractAssetsFromHtmlRegex = new RegExp(
    String.raw`${CDN_DOMAIN}(?<package>(?:@[a-z0-9-]+\/)?[a-z0-9-]+(?:@[0-9.]+)?)\/?(?<path>[^\?^"]+)?\??[^"]*`,
    "g"
  )
  const assets = ([...htmlSrc.matchAll(extractAssetsFromHtmlRegex)] as RegexResult).map<Asset>(
    ({ 0: url, groups }) => ({
      url,
      path: join(
        groups.package,
        groups.path ?? "",
        groups.path == undefined || !groups.path.split("/").pop()!.includes(".") ? "index.js" : ""
      ).replaceAll("\\", "/")
    })
  )

  // Continue fetching until all assets have been fetched
  while (true) {
    const pendingAssets = assets.filter(asset => !("content" in asset))
    if (pendingAssets.length == 0) break

    await Promise.all(
      pendingAssets.map(async asset => {
        // To fetch copies of `.js` files that work in browsers instead of Node.js,
        // we need to change the user agent string in the request header.
        // https://github.com/esm-dev/esm.sh/blob/v135/server/esm_handler.go#L56
        // https://github.com/nodejs/undici/blob/v6.5.0/test/fetch/user-agent.js
        const response = await fetch(asset.url, { headers: REQUEST_HEADERS.fetch })

        if (asset.path.endsWith(".woff2")) {
          asset.content = Buffer.from(await response.arrayBuffer())
          return
        }

        const source = await response.text()
        let importedAssetPaths: string[]

        if (asset.path.endsWith(".css")) {
          importedAssetPaths = [...source.matchAll(/url\(["'](?<path>(?!data:)[^"']+)["']\)/g)].map(
            ({ groups }) => groups!.path
          )
          asset.content = importedAssetPaths
            .map<[string, string]>(assetPath => [assetPath, assetPath.replace(/\?.*/, "")])
            .reduce((accumulator, [originalPath, newPath]) => accumulator.replace(originalPath, newPath), source)
        } else {
          importedAssetPaths = [
            ...source.matchAll(new RegExp(String.raw`${IMPORT_EXPORT_PREFIX}["'](?<path>[^"']+\.m?js)["']`, "g"))
          ].map(({ groups }) => groups!.path)
          asset.content = source.replaceAll(
            new RegExp(String.raw`(${IMPORT_EXPORT_PREFIX})["']([^"']+)["']`, "g"),
            (_, importExportPrefix, path) => `${importExportPrefix} "${path.replace(PATH_PREFIX_TO_REMOVE, "")}"`
          )
        }

        // https://stackoverflow.com/a/66883732/
        const importedAssets = importedAssetPaths
          .map(path => new URL(path, asset.url))
          .map(url => ({ url: url.href, path: url.pathname.replace(PATH_PREFIX_TO_REMOVE, "").replace(/^\//, "") }))
          .filter(asset => assets.find(existingAsset => existingAsset.url == asset.url) == undefined)
        for (const asset of importedAssets) assets.push(asset)
      })
    )
  }

  return assets as FetchedAsset[]
}

const htmlSrc = await readFile(VIEW_HTML_SRC_PATH, "utf-8")
const assets = await fetchAssets(htmlSrc)

if (existsSync(ASSETS_PATH)) await rm(ASSETS_PATH, { recursive: true })
mkdir(ASSETS_PATH)

let html = htmlSrc
for (const { url, path } of assets) html = html.replaceAll(url, `/${path}`)
await writeFile(VIEW_HTML_PATH, html)

await Promise.all(
  assets.map(async ({ path, content }) => {
    const filePath = resolve(ASSETS_PATH, path)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  })
)
