import { existsSync } from "fs"

import { Command } from "@oclif/core"
import inquirer from "inquirer"
import dedent from "string-dedent"

import { DATA_FILE, DATA_FILENAME } from "../lib/constants.js"
import { DataStore, Errors, MediaDownloadOption } from "../lib/types.js"
import { archiveInfoFrom, writeData } from "../lib/utils.js"

export default class Init extends Command {
  static description = dedent`
    Initialize a new archive

    Supported URL:
    https://instagram.com/{username}/
    https://instagram.com/{username}/saved/all-posts/
    https://instagram.com/{username}/saved/{collection_name}/{collection_id}/
  `

  public async run(): Promise<void> {
    if (existsSync(DATA_FILE)) throw Errors.DATA_FILE_ALREADY_EXISTS

    const { url, download_media } = await inquirer.prompt<{ url: string; download_media: MediaDownloadOption }>([
      {
        name: "url",
        type: "input",
        message: "Url of collection:",
        validate(input) {
          try {
            archiveInfoFrom(input)
            return true
          } catch (error) {
            return false
          }
        }
      },
      {
        name: "download_media",
        type: "input",
        message: `Whether to download media. Valid values: ${Object.keys(MediaDownloadOption).join(", ")}`,
        default: "all",
        validate: input => input in MediaDownloadOption
      }
    ])

    const data: DataStore = { url, download_media, posts: [] }

    await writeData(data, false)
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
