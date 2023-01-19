import { createReadStream, existsSync } from "fs"
import { lstat, mkdir, readFile, readdir, writeFile } from "fs/promises"
import { createServer } from "http"
import { resolve } from "path"

import { Command } from "commander"
import read from "read"

import { DATA_FILE_PATH, MEDIA_FOLDER } from "./constants.js"
import { downloadMedias, fetchNewPosts } from "./request.js"
import { DataStore, Errors, IWithMedia } from "./types.js"
import {
  fullCommandNameFrom,
  isValidYesNoOption,
  mediaSourceFrom,
  parseCollectionUrl,
  postFrom,
  postsHTMLFrom,
  printNotInitializedMessage,
  replaceLine,
} from "./utils.js"

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

collectionCommand.command("fetch").option("--open", "Open Puppeteer in a window", false).action(fetchCommand)
async function fetchCommand({ open }: { open: boolean }, command: Command) {
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
  } catch (error: any) {
    if (error == Errors["NO_NEW_POST"]) replaceLine("No new post found")
    else if (error == Errors["NOT_INITIALIZED"] || error?.code == "ENOENT") printNotInitializedMessage(command)
    else console.error(Errors[error] ?? error)
  }
}

collectionCommand.command("view").option("--port <number>", "Specify server port", "3000").action(viewCommand)
async function viewCommand({ port }: { port: number }, command: Command) {
  const mediaFolder = resolve("media")
  const mediaFiles = await readdir(mediaFolder).catch(() => null)

  let url, posts
  try {
    ;({ url, posts } = JSON.parse(await readFile(DATA_FILE_PATH, "utf8")) as DataStore)
  } catch (error: any) {
    if (error?.code == "ENOENT") printNotInitializedMessage(command)
    return
  }

  const postsSortedByRecency = Array.from(posts).reverse()
  const mediaPaths =
    mediaFiles != null
      ? await Promise.all(
          postsSortedByRecency.map(async post => {
            const postFolder = resolve(mediaFolder, post.code)
            return mediaFiles.includes(post.code) && (await lstat(postFolder)).isDirectory()
              ? (await readdir(postFolder)).map(file => `${post.code}/${file}`)
              : [mediaFiles.find(file => file.startsWith(post.code))]
          })
        )
      : null
  const { collectionName } = parseCollectionUrl(url)

  const html = postsHTMLFrom(collectionName, postsSortedByRecency, mediaPaths)

  createServer((request, response) => {
    const return404 = () => {
      response.statusCode = 404
      response.end()
    }

    if (request.url == null || request.url == "") {
      return404()
    } else if (request.url == "/" || request.url == "index.html") {
      response.end(html)
    } else {
      const filePath = resolve(mediaFolder, request.url.replace(/^\//, ""))

      if (existsSync(filePath)) createReadStream(filePath).pipe(response)
      else return404()
    }
  }).listen(port, () => console.log(`View collection at: http://localhost:${port}/`))
}

export default collectionCommand
