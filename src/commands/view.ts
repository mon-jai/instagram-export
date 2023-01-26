import { createReadStream, existsSync } from "fs"
import { lstat, readFile, readdir } from "fs/promises"
import { createServer } from "http"
import { resolve } from "path"

import { Command, Flags } from "@oclif/core"

import { DATA_FILE_PATH } from "../lib/constants.js"
import { DataStore } from "../lib/types.js"
import { parseCollectionUrl, postsHTMLFrom, printNotInitializedMessage } from "../lib/utils.js"

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

    const { url, posts } = JSON.parse(await readFile(DATA_FILE_PATH, "utf8")) as DataStore

    const postsSortedByRecency = Array.from(posts).reverse()
    const mediaPaths =
      mediaFiles != null
        ? await Promise.all(
            postsSortedByRecency.map(async post => {
              const postFolder = resolve(mediaFolder, post.code)
              return mediaFiles.includes(post.code) && (await lstat(postFolder)).isDirectory()
                ? (await readdir(postFolder)).map(file => `${post.code}/${file}`)
                : [mediaFiles.find(file => file.startsWith(post.code))]
            })
          )
        : null
    const { collectionName } = parseCollectionUrl(url)

    const html = postsHTMLFrom(collectionName, postsSortedByRecency, mediaPaths)

    createServer((request, response) => {
      const return404 = () => {
        response.statusCode = 404
        response.end()
      }

      if (request.url == null || request.url == "") {
        return404()
      } else if (request.url == "/" || request.url == "index.html") {
        response.end(html)
      } else {
        const filePath = resolve(mediaFolder, request.url.replace(/^\//, ""))

        if (existsSync(filePath)) createReadStream(filePath).pipe(response)
        else return404()
      }
    }).listen(port, () => console.log(`View collection at: http://localhost:${port}/`))
  }

  async catch(error: any) {
    if (error?.code == "ENOENT") printNotInitializedMessage(this)
    else throw error
  }
}