import { existsSync } from "fs"
import { mkdir, readFile, writeFile } from "fs/promises"

import { Command, Flags } from "@oclif/core"

import { DATA_FILE_PATH, MEDIA_FOLDER } from "../lib/constants.js"
import { downloadMedias, fetchNewPosts } from "../lib/request.js"
import { DataStore, Errors, IWithMedia } from "../lib/types.js"
import { mediaSourceFrom, postFrom, printNotInitializedMessage, replaceLine } from "../lib/utils.js"

export default class Fetch extends Command {
  static description = "Fetch Instagram for new posts of an archive"

  static flags = {
    open: Flags.boolean({ description: "Open Puppeteer in a window", default: false }),
  }

  public async run(): Promise<void> {
    const {
      flags: { open },
    } = await this.parse(Fetch)

    const {
      url,
      download_media,
      posts: postsSavedFromLastRun,
    }: Partial<DataStore> = JSON.parse(await readFile(DATA_FILE_PATH, "utf8"))

    if (url == undefined || download_media == undefined || postsSavedFromLastRun == undefined) {
      throw Errors["NOT_INITIALIZED"]
    }

    const startTime = Date.now()

    const newPosts = await fetchNewPosts(url, postsSavedFromLastRun, open)
    const data: DataStore = {
      url,
      download_media,
      posts: [...postsSavedFromLastRun, ...newPosts.map(postFrom)],
    }

    if (download_media) {
      if (!existsSync(MEDIA_FOLDER)) await mkdir(MEDIA_FOLDER)

      const mediaSources = (newPosts as IWithMedia[]).map(mediaSourceFrom)
      await downloadMedias(mediaSources)
    }

    await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))

    console.log(
      `\nFetched ${newPosts.length} new posts${download_media ? " and media " : " "}` +
        `in ${(Date.now() - startTime) / 1000} seconds`
    )
  }

  async catch(error: any) {
    if (error == Errors["NO_NEW_POST"]) replaceLine("No new post found")
    else if (error == Errors["NOT_INITIALIZED"] || error?.code == "ENOENT") printNotInitializedMessage(this)
    else if (error in Errors) console.error(Errors[error])
    else throw error
  }
}
