import { lstat, readFile, readdir, rm } from "fs/promises"
import { resolve } from "path"

import { Args, Command } from "@oclif/core"
import YAML from "yaml"

import { DATA_FILE, MEDIA_FOLDER } from "../lib/constants.js"
import { DataStore, Errors } from "../lib/types.js"
import { isValidDataStore, printNotInitializedMessage, writeData } from "../lib/utils.js"

export default class Delete extends Command {
  static description = "Delete a post from an archive"

  static args = {
    code: Args.string({
      description: "Code of posts to be deleted from the archive (could be more than one)",
      required: true
    })
  }

  public async run(): Promise<void> {
    const codesToDelete = this.argv
    const oldData: Partial<DataStore> = YAML.parse(await readFile(DATA_FILE, "utf8"))
    isValidDataStore(oldData)
    const { url, download_media, posts } = oldData

    for (const code of codesToDelete) {
      const pathToDelete = (await readdir(MEDIA_FOLDER)).find(filename => filename.startsWith(code))
      if (pathToDelete == undefined) continue

      const absolutePathToDelete = resolve(MEDIA_FOLDER, pathToDelete)
      const deletedFilesCount = (await lstat(absolutePathToDelete)).isDirectory()
        ? (await readdir(absolutePathToDelete)).length
        : 1

      await rm(absolutePathToDelete, { recursive: true })
      console.log(`${code}: deleted ${deletedFilesCount} medias`)
    }

    await writeData({ url, download_media, posts: posts.filter(post => !codesToDelete.includes(post.code)) })
  }

  async catch(error: any) {
    if (error == Errors["NOT_INITIALIZED"] || error?.code == "ENOENT") printNotInitializedMessage(this)
    else throw error
  }
}
