import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { URL } from "url"
import { promisify } from "util"

import { queue } from "async"
import { Command } from "commander"
import download from "download"
import keytar from "keytar"
import { last, pick, pickBy, random } from "lodash-es"
import puppeteer from "puppeteer"
import callbackRead from "read"
import type { ReadonlyDeep } from "type-fest"

const read = promisify(callbackRead)

type Location = {
  pk: number
  short_name: string
  name: string
  address: string
  city: string
  lng: number
  lat: number
}
type User = { pk: number; username: string; full_name: string }
type Caption = { pk: string; text: string; created_at: number }
type Image = { image_versions2: { candidates: { url: string }[] } }
type Video = Image & { video_versions: [{ url: string }] } // All videos contain an "image_versions2" key
type Carousel = { carousel_media: (Image | Video)[] }
type UndocumentedProperties = { [Key: string]: any }

// The following types are not meant to be altered within the lifecycle of the script
type Post = ReadonlyDeep<{
  pk: string
  id: string
  media_type: number
  code: string
  location?: Location
  user: User
  caption?: Caption
}>
type RawPost = ReadonlyDeep<
  Omit<Post, "location" | "user" | "caption"> & {
    location?: Location & UndocumentedProperties
    user: User & UndocumentedProperties
    caption: (Caption & UndocumentedProperties) | null
  } & (Image | Video | Carousel)
>
type MediaSource = ReadonlyDeep<
  { code: string } & (
    | { type: "image"; url: string }
    | { type: "video"; url: string }
    | { type: "carousel"; urls: string[] }
  )
>
type InstagramResponse = ReadonlyDeep<{ items: [{ media: RawPost }] }>
type DataStore = ReadonlyDeep<{ url: string; username: string; download_media: boolean; posts: Post[] }>

enum CollectionError {
  NOT_INITIALIZED,
  NO_NEW_PHOTO,
  NO_OVERLAP,
  RATE_LIMIT_REACHED,
  PASSWORD_NOT_FOUND,
}

const KEYTAR_SERVICE_NAME = "instagram-dl"
const COLLECTION_DATA_FILE = join(process.cwd(), "data.json")

// Utility functions

function printLine(message: string) {
  process.stdout.write(message)
}

function replaceLine(message: string) {
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

function isValidYesNoOption(userinput: string): userinput is "Y" | "N" {
  return userinput == "Y" || userinput == "N"
}

// Casting functions

function postFrom(rawPost: RawPost): Post {
  const { pk, id, media_type, code, location, user, caption } = rawPost
  const post = {
    pk,
    id,
    media_type,
    code,
    location: pick(location, ["pk", "short_name", "name", "address", "city", "lng", "lat"]),
    user: pick(user, ["pk", "username", "full_name"]),
    caption: pick(caption, ["pk", "text", "created_at"]),
  }

  // For value equales to undefined (location) or null (caption), pick returns a empty object
  // We remove those empty object from output
  return pickBy(post, value => typeof value != "object" || Object.keys(value).length != 0) as Post
}

function urlFrom(media: ReadonlyDeep<Image | Video>) {
  if ("video_versions" in media) {
    return media.video_versions[0].url
  } else {
    return media.image_versions2.candidates[0].url
  }
}

function mediaSourceFrom(rawPost: RawPost): MediaSource {
  if ("image_versions2" in rawPost) {
    return {
      code: rawPost.code,
      type: "video_versions" in rawPost ? "video" : "image",
      url: urlFrom(rawPost),
    }
  } else {
    const { code, carousel_media } = rawPost
    return {
      code: code,
      type: "carousel",
      urls: carousel_media.map(media => urlFrom(media)),
    }
  }
}

function rawPostsFrom(responses: ReadonlyDeep<InstagramResponse[]>) {
  // Order of responses at the begining: [{ items: [12, 11, 10, 9] }, { items: [8, 7, 6, 5] }, { items: [4, 3, 2, 1] }]
  return Array.from(responses)
    .reverse() // [{ items: [4, 3, 2, 1] }, { items: [8, 7, 6, 5] }, { items: [12, 11, 10, 9] }]
    .map(result => result.items.map(item => item.media).reverse()) // [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
    .flat() // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

function fullCommandNameFrom(command: Readonly<Command>) {
  let commandName = ""
  let currentCommand: Command | null = command

  while (currentCommand != null) {
    commandName = `${currentCommand.name()} ${commandName}`
    currentCommand = currentCommand.parent
  }

  return commandName.trim()
}

// Here the main logic begins

async function getNewPostsFromInstagram(
  url: string,
  auth: { username: string; password: string },
  savedPosts: ReadonlyDeep<Post[]>
) {
  let browser: puppeteer.Browser
  return new Promise<ReadonlyDeep<RawPost[]>>(async (resolve, reject) => {
    browser = await puppeteer.launch()
    const page = await browser.newPage()

    const responses: InstagramResponse[] = []
    const firstRun = savedPosts.length == 0
    const lastSavedPosts: Post = last(savedPosts) as Post

    printLine("Getting posts from Instagram...")

    page.setDefaultTimeout(0)
    page.on("response", async response => {
      if (!new URL(response.request().url()).pathname.match(/\/api\/v1\/feed\/collection\/\d+\/posts\//)) {
        return
      }

      let json: InstagramResponse
      try {
        json = await response.json()
      } catch {
        return
      }

      responses.push(json)

      // First response
      if (responses.length == 1 && !firstRun && last(rawPostsFrom(responses))?.pk == lastSavedPosts.pk) {
        reject(CollectionError["NO_NEW_PHOTO"])
      }

      if (!firstRun && json.items.find(Post => Post.media.pk == lastSavedPosts.pk)) {
        const rawPosts = rawPostsFrom(responses)
        const indexOfNewElements = rawPosts.findIndex(rawPost => rawPost.pk == lastSavedPosts.pk) + 1

        resolve(rawPosts.slice(indexOfNewElements))
      }
    })

    // Login to Instagram
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle0" })
    await page.type('input[name="username"]', auth.username, { delay: 100 + random(0, 150) })
    await page.type('input[name="password"]', auth.password, { delay: 100 + random(0, 150) })
    await page.evaluate(`document.querySelector('button[type="submit"]').click()`)
    // If Instagram displayed a rate limit message, exit the function earlier
    // <p aria-atomic="true" data-testid="login-error-message" id="slfErrorAlert" role="alert">Please wait a few minutes before you try again.</p>
    page
      .waitForSelector('p[data-testid="login-error-message"]')
      .then(() => reject(CollectionError["RATE_LIMIT_REACHED"]))
      .catch(() => {}) // ProtocolError will be thrown under normal execution after the "finally" cleanup function being executed

    // ProtocolError will be thrown,
    // if the "finally" cleanup function being executed (promise is either resolved or rejected) before all the statements below are executed
    try {
      // "Save Your Login Info?" page
      await page.waitForFunction('window.location.pathname == "/accounts/onetap/"')
      await page.evaluate(`document.querySelector('button[type="button"]')?.click()`)

      // Navigate to collection
      await page.goto(url)
      // Wait until the first image being loaded
      // Spinner might not be mounted to DOM if the collection has too few items therefore looking for it may stuck the crawler
      await page.waitForSelector("main article a img")
      // Scroll to bottom to load old posts
      await page.evaluate("setInterval(() => window.scrollTo(0, document.body.scrollHeight), 10)")
      // Wait until all posts are loaded (hence the spinner is removed from DOM)
      // There are two spinner elements that will be mounted to DOM
      // both of them are indirect children of `main` but only the second one get mounted is a indirect child of `article`
      await page.waitForFunction(`document.querySelector('article [data-visualcompletion="loading-state"]') == null`)
    } catch (error: any) {
      if (error.name != "ProtocolError") throw error
    }

    // If we didn't find the last saved post from the previous run / this is the first run

    let rawPosts = rawPostsFrom(responses)

    if (!firstRun) {
      // Look for posts saved in last run
      for (const savedPost of Array.from(savedPosts).reverse()) {
        const indexOfNewElements = rawPosts.findIndex(rawPost => rawPost.pk === savedPost.pk)

        if (indexOfNewElements != -1) {
          rawPosts = rawPosts.slice(indexOfNewElements)
          break
        }
      }
    }

    resolve(rawPosts)
  }).finally(async () => {
    await browser.close()
    replaceLine("Getting posts from Instagram... Done\n")
  })
}

async function downloadMedias(mediaSources: ReadonlyDeep<MediaSource[]>) {
  let downloadedCount = 0

  const downloadQueue = queue(async (media: MediaSource) => {
    if (media.type == "image" || media.type == "video") {
      const filename = `${media.code}.${media.type == "image" ? "jpg" : "mp4"}`
      await download(media.url, join(process.cwd(), "photo"), { filename })
    } else {
      await Promise.all(media.urls.map(url => download(url, join(process.cwd(), "photo", `${media.code}`))))
    }

    downloadedCount++
    if (downloadedCount != mediaSources.length) {
      replaceLine(`Fetching images... ${downloadedCount}/${mediaSources.length}`)
    } else {
      replaceLine("Fetching images... Done\n")
    }
  }, 10)

  for (const media of mediaSources) {
    downloadQueue.push(media)
  }

  await downloadQueue.drain()

  if (downloadedCount != mediaSources.length) {
    console.log(`${mediaSources.length - downloadedCount} Posts failed to download`)
  }
}

class CollectionCommand extends Command {
  constructor(name: string) {
    super(name)

    this.command("init")
      .option("--disable-media-download")
      .action(async () => {
        const url = await read({ prompt: "Url of collection: " })
        const username = await read({ prompt: "Username: " })
        const password =
          (await keytar.getPassword(KEYTAR_SERVICE_NAME, username)) ??
          (await read({ prompt: "Password: ", silent: true }))
        let download_media

        do {
          download_media = (await read({ prompt: "Download media [Y/n]?", default: "Y" })).toUpperCase()
        } while (!isValidYesNoOption(download_media))

        const data: DataStore = { url, username, download_media: download_media == "Y", posts: [] }

        keytar.setPassword(KEYTAR_SERVICE_NAME, username, password)
        await writeFile(COLLECTION_DATA_FILE, JSON.stringify(data, null, 2))
      })

    this.action(async (_, command: Command) => {
      try {
        const {
          url,
          username,
          download_media,
          posts: savedPosts,
        }: Partial<DataStore> = JSON.parse(await readFile(COLLECTION_DATA_FILE, "utf8"))

        if (url == undefined || username == undefined || download_media == undefined || savedPosts == undefined) {
          throw CollectionError["NOT_INITIALIZED"]
        }

        const password = await keytar.getPassword(KEYTAR_SERVICE_NAME, username)

        if (password == null) {
          throw CollectionError["PASSWORD_NOT_FOUND"]
        }

        const startTime = Date.now()

        const newPosts = await getNewPostsFromInstagram(url, { username, password }, savedPosts)
        const posts = [...savedPosts, ...newPosts.map(postFrom)]
        const newMediaSources = newPosts.map(mediaSourceFrom)
        const data: DataStore = { url, username, download_media, posts }

        console.log(`${newPosts.length} new photo found`)
        if (download_media) await downloadMedias(newMediaSources)
        await writeFile(COLLECTION_DATA_FILE, JSON.stringify(data, null, 2))

        console.log(`Time taken: ${(Date.now() - startTime) / 1000} seconds`)
      } catch (error: any) {
        if (error == CollectionError["NO_NEW_PHOTO"]) {
          console.log("No new photo found")
        } else if (error == CollectionError["NOT_INITIALIZED"] || error?.code == "ENOENT") {
          const initCommand = fullCommandNameFrom(command) + " init"
          console.error(`Current directory not initialized, use ${initCommand} before running this command\n`)
          this.help({ error: true })
        } else {
          console.error(CollectionError[error] ?? error)
        }
      }
    })
  }
}

export default CollectionCommand
