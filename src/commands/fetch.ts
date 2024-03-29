import { existsSync } from "fs"
import { mkdir, readFile } from "fs/promises"

import { Command, Flags } from "@oclif/core"
import { uniqBy } from "lodash-es"
import YAML from "yaml"

import { DATA_FILE, MEDIA_FOLDER } from "../lib/constants.js"
import { downloadMedias, fetchNewPosts } from "../lib/request.js"
import { DataStore, Errors, IWithMedia } from "../lib/types.js"
import {
  isValidDataStore,
  mediaSourceFrom,
  postFrom,
  printNotInitializedMessage,
  replaceLine,
  writeData
} from "../lib/utils.js"

export default class Fetch extends Command {
  static description = "Fetch Instagram for new posts of an archive"

  static flags = {
    open: Flags.boolean({ description: "Open Puppeteer in a window", default: false }),
    refetch: Flags.boolean({ description: "Re-fetch the whole collection and update existing posts", default: false }),
    // We do not define a default value here to avoid oclif including it in the help message.
    "max-page": Flags.integer({ description: "Maximum pages to fetch" })
  }

  public async run(): Promise<void> {
    const {
      flags: { open, "max-page": maxPage = Number.MAX_VALUE, refetch: refetchCollection }
    } = await this.parse(Fetch)

    const oldData: Partial<DataStore> = YAML.parse(await readFile(DATA_FILE, "utf8"))
    isValidDataStore(oldData)
    const { url, download_media, posts: postsSavedFromLastRun } = oldData

    const startTime = Date.now()

    const newInstagramPosts = await fetchNewPosts(url, refetchCollection ? [] : postsSavedFromLastRun, open, maxPage)
    const newPosts = newInstagramPosts
      .map(postFrom)
      .filter(post => postsSavedFromLastRun.find(oldPost => post.pk == oldPost.pk) == undefined)
    const oldPosts = postsSavedFromLastRun.map(
      savedPost => newPosts.find(newPost => newPost.pk == savedPost.pk) ?? savedPost
    )

    const data: DataStore = {
      url,
      download_media,
      posts: uniqBy([...oldPosts, ...newPosts], "id")
    }

    if (download_media) {
      if (!existsSync(MEDIA_FOLDER)) await mkdir(MEDIA_FOLDER)

      const mediaSources = (newInstagramPosts as IWithMedia[]).map(media => mediaSourceFrom(media, download_media))
      await downloadMedias(mediaSources)
    }

    await writeData(data)

    console.log(
      `\nFetched ${newInstagramPosts.length} new posts${download_media ? " and media " : " "}` +
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
