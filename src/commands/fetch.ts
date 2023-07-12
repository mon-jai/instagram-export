import { existsSync } from "fs"
import { mkdir, readFile, writeFile } from "fs/promises"

import { Command, Flags } from "@oclif/core"
import { uniqBy } from "lodash-es"
import YAML from "yaml"

import { DATA_FILE, MEDIA_FOLDER, YAML_CONFIG } from "../lib/constants.js"
import { downloadMedias, fetchNewPosts } from "../lib/request.js"
import { DataStore, Errors, IWithMedia } from "../lib/types.js"
import { isNullableOrEmpty, mediaSourceFrom, postFrom, printNotInitializedMessage, replaceLine } from "../lib/utils.js"

export default class Fetch extends Command {
  static description = "Fetch Instagram for new posts of an archive"

  static flags = {
    open: Flags.boolean({ description: "Open Puppeteer in a window", default: false }),
    "max-page": Flags.integer({ description: "Maximum pages to fetch" })
  }

  public async run(): Promise<void> {
    const {
      flags: { open, "max-page": maxPage = Number.MAX_VALUE }
    } = await this.parse(Fetch)

    const {
      url,
      download_media,
      posts: postsSavedFromLastRun
    }: Partial<DataStore> = YAML.parse(await readFile(DATA_FILE, "utf8"))

    if (url === undefined || download_media === undefined || postsSavedFromLastRun === undefined) {
      throw Errors["NOT_INITIALIZED"]
    }

    const startTime = Date.now()

    const newPosts = await fetchNewPosts(url, postsSavedFromLastRun, open, maxPage)
    const data: DataStore = {
      url,
      download_media,
      posts: uniqBy([...postsSavedFromLastRun, ...newPosts.map(postFrom)], "id")
    }

    if (download_media) {
      if (!existsSync(MEDIA_FOLDER)) await mkdir(MEDIA_FOLDER)

      const mediaSources = (newPosts as IWithMedia[]).map(mediaSourceFrom)
      await downloadMedias(mediaSources)
    }

    await writeFile(
      DATA_FILE,
      YAML.stringify(data, (_key, value) => (isNullableOrEmpty(value) ? undefined : value), YAML_CONFIG)
        .replace(/^  /gm, "")
        .replace(/^-/gm, "\n-")
    )

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
