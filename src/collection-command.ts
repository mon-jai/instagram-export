import { readFile, writeFile } from "fs/promises"
import { join } from "path"

import { Command } from "commander"
import keytar from "keytar"

import { KEYTAR_SERVICE_NAME } from "./constants.js"
import { downloadMedias, getNewPosts } from "./request.js"
import { DataStore, Errors } from "./types.js"
import { fullCommandNameFrom, isValidYesNoOption, mediaSourceFrom, postFrom, read } from "./utils.js"

// Constants

const DATA_FILE_PATH = join(process.cwd(), "data.json")

const collectionCommand = new Command("collection")

collectionCommand
  .command("init")
  .option("--disable-media-download")
  .action(async () => {
    const url = await read({ prompt: "Url of collection: " })
    const username = await read({ prompt: "Username: " })
    const password =
      (await keytar.getPassword(KEYTAR_SERVICE_NAME, username)) ?? (await read({ prompt: "Password: ", silent: true }))
    let download_media

    do {
      download_media = (await read({ prompt: "Download media [Y/n]?", default: "Y" })).toUpperCase()
    } while (!isValidYesNoOption(download_media))

    const data: DataStore = { url, username, download_media: download_media == "Y", posts: [] }

    keytar.setPassword(KEYTAR_SERVICE_NAME, username, password)
    await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))
  })

collectionCommand.action(async (_, command: Command) => {
  try {
    const {
      url,
      username,
      download_media,
      posts: postsSavedFromLastRun,
    }: Partial<DataStore> = JSON.parse(await readFile(DATA_FILE_PATH, "utf8"))

    if (
      url == undefined ||
      username == undefined ||
      download_media == undefined ||
      postsSavedFromLastRun == undefined
    ) {
      throw Errors["NOT_INITIALIZED"]
    }

    const password = await keytar.getPassword(KEYTAR_SERVICE_NAME, username)

    if (password == null) {
      throw Errors["PASSWORD_NOT_FOUND"]
    }

    const startTime = Date.now()

    const newPosts = await getNewPosts(url, { username, password }, postsSavedFromLastRun)
    const data: DataStore = {
      url,
      username,
      download_media,
      posts: [...postsSavedFromLastRun, ...newPosts.map(postFrom)],
    }

    console.log(`${newPosts.length} new posts found`)
    if (download_media) await downloadMedias(newPosts.map(mediaSourceFrom))
    await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))

    console.log(`Time taken: ${(Date.now() - startTime) / 1000} seconds`)
  } catch (error: any) {
    if (error == Errors["NO_NEW_PHOTO"]) {
      console.log("No new post found")
    } else if (error == Errors["NOT_INITIALIZED"] || error?.code == "ENOENT") {
      const initCommand = fullCommandNameFrom(command) + " init"
      console.error(`Current directory not initialized, use ${initCommand} before running this command\n`)
      collectionCommand.help({ error: true })
    } else {
      console.error(Errors[error] ?? error)
    }
  }
})

export default collectionCommand
