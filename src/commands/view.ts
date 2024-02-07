import { once } from "events"
import { createReadStream, existsSync } from "fs"
import { readFile } from "fs/promises"
import { createServer } from "http"
import { resolve } from "path"

import { Command, Flags } from "@oclif/core"
import open from "open"
import YAML from "yaml"

import { ASSETS_PATH, DATA_FILE, MEDIA_DIRECTORY_NAME } from "../lib/constants.js"
import { DataStore } from "../lib/types.js"
import { archiveInfoFrom, getMediaPaths, isJavaScriptFile, printNotInitializedMessage } from "../lib/utils.js"
import generateViewHTML from "../lib/view-html.js"

export default class View extends Command {
  static description = "View archive in a webpage"

  static flags = {
    dev: Flags.boolean({ description: "Use `src/view.html` instead of downloaded assets", default: false }),
    port: Flags.integer({ description: "Specify server port", default: 80 })
  }

  public async run(): Promise<void> {
    const {
      flags: { dev, port }
    } = await this.parse(View)

    const { url, posts: postsSortedByOldest } = YAML.parse(await readFile(DATA_FILE, "utf8")) as DataStore

    const { archiveName } = archiveInfoFrom(url)
    const posts = Array.from(postsSortedByOldest).reverse()
    const mediaPaths = await getMediaPaths(postsSortedByOldest)
    const html = await generateViewHTML({ archiveName, posts, mediaPaths, dev })

    const server = createServer((request, response) => {
      if (request.url == "/") {
        response.end(html)
        return
      }

      const filePath = new URL(request.url!, `http://${request.headers.host}`).pathname.replace(/^\//, "")
      if (filePath.startsWith(MEDIA_DIRECTORY_NAME) && existsSync(filePath)) {
        createReadStream(filePath).pipe(response)
        return
      }

      const assetFilePath = resolve(ASSETS_PATH, filePath)
      if (existsSync(assetFilePath)) {
        if (isJavaScriptFile(assetFilePath)) response.setHeader("Content-Type", "application/javascript")
        else if (assetFilePath.endsWith(".svg")) response.setHeader("Content-Type", "image/svg+xml")

        createReadStream(assetFilePath).pipe(response)
        return
      }

      response.statusCode = 404
      response.end()
    })

    server.listen(port)
    await once(server, "listening")

    const archiveUrl = `http://localhost${port != 80 ? ":" + port : ""}/`
    console.log(`View collection at: ${archiveUrl}`)
    await open(archiveUrl)
  }

  async catch(error: any) {
    if (error?.code == "ENOENT") printNotInitializedMessage(this)
    else throw error
  }
}
