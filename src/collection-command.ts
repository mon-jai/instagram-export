import { readFile, writeFile } from "fs/promises"

import { Command } from "commander"
import read from "read"

import { DATA_FILE_PATH } from "./constants.js"
import { downloadMedias, getNewPosts } from "./request.js"
import { DataStore, Errors } from "./types.js"
import { fullCommandNameFrom, isValidYesNoOption, mediaSourceFrom, postFrom, replaceLine } from "./utils.js"

const collectionCommand = new Command("collection")

collectionCommand.command("init").action(async () => {
  const url = await read({ prompt: "Url of collection: " })
  let download_media

  do {
    download_media = (await read({ prompt: "Download media [Y/n]?", default: "Y" })).toUpperCase().trim()
  } while (!isValidYesNoOption(download_media))

  const data: DataStore = { url, download_media: download_media == "Y", posts: [] }

  await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))
})

collectionCommand.option("--open").action(async ({ open = false }: { open?: boolean }, command: Command) => {
  try {
    const {
      url,
      download_media,
      posts: postsSavedFromLastRun,
    }: Partial<DataStore> = JSON.parse(await readFile(DATA_FILE_PATH, "utf8"))

    if (url == undefined || download_media == undefined || postsSavedFromLastRun == undefined) {
      throw Errors["NOT_INITIALIZED"]
    }

    const startTime = Date.now()

    const newPosts = await getNewPosts(url, postsSavedFromLastRun, open)
    const data: DataStore = {
      url,
      download_media,
      posts: [...postsSavedFromLastRun, ...newPosts.map(postFrom)],
    }

    if (download_media) await downloadMedias(newPosts.map(mediaSourceFrom))

    await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))

    console.log(
      `\nFetched ${newPosts.length} new posts${download_media ? " and media " : " "}` +
        `in ${(Date.now() - startTime) / 1000} seconds`
    )
  } catch (error: any) {
    if (error == Errors["NO_NEW_POST"]) {
      replaceLine("No new post found")
    } else if (error == Errors["NOT_INITIALIZED"] || error?.code == "ENOENT") {
      const initCommand = fullCommandNameFrom(command) + " init"
      console.error(
        `Current directory not initialized, make sure to inilize it with \`${initCommand}\` before running this command`
      )
      collectionCommand.help({ error: true })
    } else {
      console.error(Errors[error] ?? error)
    }
  }
})

export default collectionCommand
