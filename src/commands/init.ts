import { existsSync } from "fs"
import { writeFile } from "fs/promises"

import { Command } from "@oclif/core"
import inquirer from "inquirer"
import YAML from "yaml"

import { DATA_FILE, DATA_FILENAME, YAML_CONFIG } from "../lib/constants.js"
import { DataStore, Errors } from "../lib/types.js"
import { parseArchiveUrl } from "../lib/utils.js"

export default class Init extends Command {
  static description = [
    "Initialize a new archive",
    "\nSupported URL:",
    "https://instagram.com/{username}/",
    "https://instagram.com/{username}/saved/all-posts/",
    "https://instagram.com/{username}/saved/{collection_name}/{collection_id}/",
  ].join("\n")

  public async run(): Promise<void> {
    if (existsSync(DATA_FILE)) throw Errors.DATA_FILE_ALREADY_EXISTS

    const { url, download_media } = await inquirer.prompt<{ url: string; download_media: boolean }>([
      {
        name: "url",
        message: "Url of collection:",
        validate(input) {
          try {
            parseArchiveUrl(input)
            return true
          } catch (error) {
            return false
          }
        },
      },
      { name: "download_media", message: "Download media?", type: "confirm", default: true },
    ])

    const data: DataStore = { url, download_media, posts: [] }

    await writeFile(DATA_FILE, YAML.stringify(data, null, YAML_CONFIG))
  }

  async catch(error: any) {
    if (error == Errors["DATA_FILE_ALREADY_EXISTS"]) {
      console.log(
        `${DATA_FILENAME} already exists in the current directory. This archive has already been initialized.`
      )
    } else {
      throw error
    }
  }
}
