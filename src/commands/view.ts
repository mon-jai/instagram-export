import { once } from "events"
import { readFile } from "fs/promises"
import { createServer } from "http"

import send from "@fastify/send"
import { Command, Flags } from "@oclif/core"
import open from "open"
import dedent from "string-dedent"
import YAML from "yaml"

import { ASSETS_PATH, DATA_FILE, MEDIA_DIRECTORY_NAME } from "../lib/constants.js"
import { DataStore } from "../lib/types.js"
import { archiveInfoFrom, getMediaPaths, printNotInitializedMessage } from "../lib/utils.js"
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
    const html = await generateViewHTML({ archiveName, url, posts, mediaPaths, dev })

    const server = createServer((request, response) => {
      if (request.url == "/" || request.url == "/index.html") {
        response.end(html)
        return
      }

      const filePath = new URL(request.url!, `http://${request.headers.host}`).pathname.replace(/^\//, "")

      // Send files with partial responses (Ranges) support
      // https://stackoverflow.com/a/65804889/
      if (filePath.startsWith(MEDIA_DIRECTORY_NAME)) {
        send(request, filePath).pipe(response)
        return
      }

      send(request, filePath, { root: ASSETS_PATH }).pipe(response)
    })

    process.on("SIGINT", () => process.exit(0))
    server.listen(port)
    await once(server, "listening")

    const archiveUrl = `http://localhost${port != 80 ? ":" + port : ""}/`
    console.log(dedent`
      View collection at: ${archiveUrl}
      Exit with [Ctrl]+[C]
    `)
    await open(archiveUrl)
  }

  async catch(error: any) {
    if (error?.code == "ENOENT") printNotInitializedMessage(this)
    else throw error
  }
}
