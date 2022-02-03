import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { URL } from "url"
import { promisify } from "util"

import { queue } from "async"
import { Command } from "commander"
import download from "download"
import keytar from "keytar"
import { isEmpty, last, pick, pickBy, random } from "lodash-es"
import puppeteer, { Page } from "puppeteer"
import callbackRead from "read"
import type { ReadonlyDeep } from "type-fest"

import { KEYTAR_SERVICE_NAME } from "./constants.js"

const read = promisify(callbackRead)

// The following types are created for constructing other types (except Image and Video)

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
// All videos contain an "image_versions2" key
type Video = Image & { video_versions: [{ url: string }] }
type Carousel = { carousel_media: (Image | Video)[] }
type UndocumentedProperties = { [Key: string]: any }

// The following types are not meant to be altered once created,
// so we mark them as ReadonlyDeep

// The properties of a Instagram post that will be extracted and saved in the output data file
type Post = ReadonlyDeep<{
  pk: string
  id: string
  media_type: number
  code: string
  location?: Location
  user: User
  caption?: Caption
}>
// The structure of the output data file
type DataStore = ReadonlyDeep<{ url: string; username: string; download_media: boolean; posts: Post[] }>
// The structure used for downloading medias from Instagram
type MediaSource = ReadonlyDeep<
  { code: string } & (
    | { type: "image"; url: string }
    | { type: "video"; url: string }
    | { type: "carousel"; urls: string[] }
  )
>

// The data structure Instagram used to store posts
// Properties that are not used will not be documented
type RawPost = ReadonlyDeep<
  Omit<Post, "location" | "user" | "caption"> & {
    location?: Location & UndocumentedProperties
    user: User & UndocumentedProperties
    caption: (Caption & UndocumentedProperties) | null
  } & (Image | Video | Carousel)
>
// The raw data format returned by Instagram
type InstagramResponse = ReadonlyDeep<{ items: [{ media: RawPost }] }>

// All the errors thrown by us in this script
enum CollectionError {
  NOT_INITIALIZED,
  NO_NEW_PHOTO,
  NO_OVERLAP,
  RATE_LIMIT_REACHED,
  PASSWORD_NOT_FOUND,
}

// Constants

const DATA_FILE_PATH = join(process.cwd(), "data.json")

// Utility functions

function printLine(message: string) {
  process.stdout.write(message)
}

function replaceLine(message: string) {
  // https://stackoverflow.com/a/59805130
  process.stdout.clearLine(-1)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

function isValidYesNoOption(userInput: string): userInput is "Y" | "N" {
  return userInput == "Y" || userInput == "N"
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

  // For value equals to undefined (location) or null (caption), pick returns a empty object
  // We remove those empty object before returning
  return pickBy(post, value => typeof value != "object" || !isEmpty(value)) as Post
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
  // Order of responses at the beginning: [{ items: [12, 11, 10, 9] }, { items: [8, 7, 6, 5] }, { items: [4, 3, 2, 1] }]
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

async function login(page: Page, auth: { username: string; password: string }) {
  // Navigate to login page
  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle0" })
  await page.type('input[name="username"]', auth.username, { delay: 100 + random(0, 150) })
  await page.type('input[name="password"]', auth.password, { delay: 100 + random(0, 150) })
  await page.evaluate(() => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click())
  // If Instagram displayed a rate limit message, exit earlier
  // <p aria-atomic="true" data-testid="login-error-message" id="slfErrorAlert" role="alert">Please wait a few minutes before you try again.</p>
  page
    .waitForSelector('p[data-testid="login-error-message"]')
    .then(() => {
      throw CollectionError["RATE_LIMIT_REACHED"]
    })
    // Under normal executions, browser will be closed while this promise is still waiting
    // thus ProtocolError will be thrown
    .catch(() => {})

  // Skip "Save Your Login Info?" page, if it is displayed
  const saveLoginInfoPageDisplayed: boolean = await Promise.race([
    // Skip the check if the page doesn't load after 3 seconds
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000)),
    new Promise<boolean>(async resolve => {
      await page.waitForFunction(() => window.location.pathname == "/accounts/onetap/")
      resolve(true)
    })
      // Under normal executions, browser will be closed while this promise is still waiting
      // thus ProtocolError will be thrown
      .catch(() => false),
  ])
  if (saveLoginInfoPageDisplayed) {
    // Press "Not Now" button
    await page.evaluate(() => document.querySelector<HTMLElement>('main div > div > button[type="button"]')?.click())
  }
}

async function captureAPIResponses(page: Page, collectionUrl: string, lastSavedPostPk: string | null) {
  return new Promise<InstagramResponse[]>(async (resolve, reject) => {
    const responses: InstagramResponse[] = []

    // ProtocolError will be thrown,
    // if the "finally" cleanup function being executed (the promise is either resolved or rejected)
    // before all the actions (goto, evaluate, waitFor) we requested are executed
    try {
      // Capture XHR responses
      page.on("response", async response => {
        if (!new URL(response.request().url()).pathname.match(/\/api\/v1\/feed\/collection\/\d+\/posts\//)) {
          return
        }

        const json: InstagramResponse | null = await response.json().catch(() => null)

        if (json == null) return
        responses.push(json)

        // If this is the first incoming response,
        // and the first post in the response is the last post saved in last run
        if (
          responses.length == 1 &&
          lastSavedPostPk != null &&
          (last(rawPostsFrom(responses)) as Post).pk == lastSavedPostPk
        ) {
          reject(CollectionError["NO_NEW_PHOTO"])
        }

        // The promise exits here
        // if this is not the first run and we found the last post saved from last run
        // in order to avoid unnecessarily fetching posts that are already saved to the data file
        // ---
        // json.items.find() is O(N) at worst
        // but rawPostsFrom() combined with rawPosts.findIndex() will be O(2N) at worst ( both of them are O(N) )
        // so checking with json.items.find() will be faster
        if (lastSavedPostPk != null && json.items.find(Post => Post.media.pk == lastSavedPostPk)) {
          resolve(responses)
        }
      })

      // Navigate to collection page
      await page.goto(collectionUrl)
      // Wait until the first image being loaded
      // Spinner might not be mounted to DOM if the collection has too few items therefore looking for it may stuck the crawler
      await page.waitForSelector("main article a img")
      // Scroll to bottom to load old posts
      await page.evaluate(() => setInterval(() => window.scrollTo(0, document.body.scrollHeight), 10))
      // Wait until all posts are loaded (hence the spinner is removed from DOM)
      // There are two spinner elements that will be mounted to DOM
      // both of them are indirect children of `main` but only the second one get mounted is a indirect child of `article`
      await page.waitForFunction(
        () => document.querySelector('article [data-visualcompletion="loading-state"]') == null
      )

      // Fetched the whole collection, yet didn't found the last post saved from last run
      resolve(responses)
    } catch (error: any) {
      if (error.name != "ProtocolError") throw error
    }
  })
}

async function getNewPosts(
  collectionUrl: string,
  auth: { username: string; password: string },
  postsSavedFromLastRun: ReadonlyDeep<Post[]>
): Promise<ReadonlyDeep<RawPost[]>> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  try {
    page.setDefaultTimeout(0)
    // null if this is the first run
    const lastSavedPostPk = last(postsSavedFromLastRun)?.pk ?? null

    printLine("Getting posts from Instagram...")

    await login(page, auth)

    const responses = await captureAPIResponses(page, collectionUrl, lastSavedPostPk)
    const rawPosts = rawPostsFrom(responses)

    if (lastSavedPostPk == null) {
      // This is the first run
      return rawPosts
    }

    let indexOfLastSavedPost = rawPosts.findIndex(rawPost => rawPost.pk == lastSavedPostPk)

    if (indexOfLastSavedPost == -1) {
      // We didn't find the last post saved in last run

      // Default value, return the whole rawPosts array (0 to rawPosts.length -1)
      // if we can't find any posts from last run
      indexOfLastSavedPost = 0

      // Look for posts saved in last run, one by one, from bottom to top
      for (const post of Array.from(postsSavedFromLastRun).reverse()) {
        const indexOfPost = rawPosts.findIndex(rawPost => rawPost.pk == post.pk)

        if (indexOfPost != -1) {
          indexOfLastSavedPost = indexOfPost
          break
        }
      }
    }

    return rawPosts.slice(indexOfLastSavedPost + 1)
  } finally {
    // Cleanup
    await browser.close()
    replaceLine("Getting posts from Instagram... Done\n")
  }
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

  downloadQueue.push(Array.from(mediaSources))
  await downloadQueue.drain()

  if (downloadedCount != mediaSources.length) {
    console.log(`${mediaSources.length - downloadedCount} Posts failed to download`)
  }
}

export default class CollectionCommand extends Command {
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
        await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))
      })

    this.action(async (_, command: Command) => {
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
          throw CollectionError["NOT_INITIALIZED"]
        }

        const password = await keytar.getPassword(KEYTAR_SERVICE_NAME, username)

        if (password == null) {
          throw CollectionError["PASSWORD_NOT_FOUND"]
        }

        const startTime = Date.now()

        const newPosts = await getNewPosts(url, { username, password }, postsSavedFromLastRun)
        const data: DataStore = {
          url,
          username,
          download_media,
          posts: [...postsSavedFromLastRun, ...newPosts.map(postFrom)],
        }

        console.log(`${newPosts.length} new photo found`)
        if (download_media) await downloadMedias(newPosts.map(mediaSourceFrom))
        await writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2))

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
