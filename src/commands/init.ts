import { existsSync } from "fs"
import { writeFile } from "fs/promises"

import { Command, ux } from "@oclif/core"

import { DATA_FILE_PATH } from "../lib/constants.js"
import { DataStore, Errors } from "../lib/types.js"
import { isValidYesNoOption } from "../lib/utils.js"

export default class Init extends Command {
  static description = "Initialize a new archive"

  public async run(): Promise<void> {
    if (existsSync(DATA_FILE_PATH)) throw Errors.DATA_FILE_ALREADY_EXISTS

    const url = await ux.prompt("Url of collection")
    let download_media

    do {
      download_media = (await ux.prompt("Download media [Y/n]", { type: "mask", default: "Y" })).toUpperCase().trim()
    } while (!isValidYesNoOption(download_media))

    const data: DataStore = {
      url,
      download_media: download_media == "Y",
      posts: [],
    }

    await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))
  }

  async catch(error: any) {
    if (error == Errors["DATA_FILE_ALREADY_EXISTS"]) {
      console.log("data.json already exists in the current directory. This archive has already been initialized.")
    } else {
      throw error
    }
  }
}
