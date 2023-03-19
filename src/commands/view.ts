import { createReadStream, existsSync } from "fs"
import { lstat, readFile, readdir } from "fs/promises"
import { createServer } from "http"
import { resolve } from "path"

import { Command, Flags } from "@oclif/core"
import open from "open"
import YAML from "yaml"

import { DATA_FILE } from "../lib/constants.js"
import generatePostsHTML from "../lib/post-html.js"
import { DataStore } from "../lib/types.js"
import { parseArchiveUrl, printNotInitializedMessage } from "../lib/utils.js"

export default class View extends Command {
  static description = "View archive in a webpage"

  static flags = {
    port: Flags.integer({ description: "Specify server port", default: 3000 }),
  }

  public async run(): Promise<void> {
    const {
      flags: { port },
    } = await this.parse(View)

    const mediaFolder = resolve("media")
    const mediaFiles = await readdir(mediaFolder).catch(() => null)

    const { url, posts } = YAML.parse(await readFile(DATA_FILE, "utf8")) as DataStore

    const { archiveName } = parseArchiveUrl(url)
    const postsSortedByRecency = Array.from(posts).reverse()
    const mediaPaths = Object.fromEntries<string[]>(
      mediaFiles !== null
        ? await Promise.all(
            posts.map(async (post): Promise<[string, string[]]> => {
              const postFolder = resolve(mediaFolder, post.code)
              let medias

              if (mediaFiles.includes(post.code) && (await lstat(postFolder)).isDirectory()) {
                medias = (await readdir(postFolder)).map(file => `${post.code}/${file}`)
              } else {
                const mediaFile = mediaFiles.find(file => file.startsWith(post.code))
                medias = mediaFile !== undefined ? [mediaFile] : []
              }

              return [post.code, medias]
            })
          )
        : posts.map(post => [post.code, []])
    )

    const html = generatePostsHTML(archiveName, postsSortedByRecency, mediaPaths)

    createServer((request, response) => {
      const return404 = () => {
        response.statusCode = 404
        response.end()
      }

      if (request.url === null || request.url === undefined || request.url == "") {
        return404()
      } else if (request.url == "/" || request.url == "index.html") {
        response.end(html)
      } else {
        const filePath = resolve(mediaFolder, request.url.replace(/^\//, ""))

        if (existsSync(filePath)) createReadStream(filePath).pipe(response)
        else return404()
      }
    }).listen(port, async () => {
      const url = `http://localhost:${port}/`

      console.log(`View collection at: ${url}`)
      await open(url)
    })
  }

  async catch(error: any) {
    if (error?.code == "ENOENT") printNotInitializedMessage(this)
    else throw error
  }
}
