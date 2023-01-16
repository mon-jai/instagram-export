import { dirname, join, resolve } from "path"
import { URL } from "url"

import { queue } from "async"
import { last } from "lodash-es"
import puppeteer, { Page } from "puppeteer"
import read from "read"
import { ReadonlyDeep } from "type-fest"

import { MEDIA_FOLDER } from "./constants.js"
import { Errors, InstagramResponse, MediaSource, Post, RawPost } from "./types.js"
import {
  download,
  findFirstNewPostIndex,
  parseCollectionUrl,
  printLine,
  randomDelay,
  rawPostsFrom,
  replaceLine,
} from "./utils.js"

async function readAndInputVerificationCode(page: Page) {
  const verificationCodeInputSelector = 'input[name="verificationCode"]'
  const verificationCodeMessageEl = (await page.waitForSelector("#verificationCodeDescription"))!
  const verificationCodeMessage = (await verificationCodeMessageEl.evaluate(el => el.textContent))!
    .trim()
    .replace("we", "Instagram")
    .replace(/.$/, ": ")

  return new Promise(async resolve => {
    // Exit point
    page.waitForNavigation().then(resolve)

    while (true) {
      let verificationCode: string = (await read({ prompt: verificationCodeMessage })).replace(/\s/g, "")
      if (/^\d{6}$/.test(verificationCode) == false) continue

      // Clear previous input, https://stackoverflow.com/a/52633235
      await page.click(verificationCodeInputSelector)
      while ((await page.$eval(verificationCodeInputSelector, el => el.value.length)) > 0) {
        await page.keyboard.press("Backspace", { delay: randomDelay() })
      }
      await page.type(verificationCodeInputSelector, verificationCode, { delay: randomDelay() })

      const authenticationResponse = (
        await Promise.all([
          page.waitForResponse(
            response => new URL(response.url()).pathname == "/api/v1/web/accounts/login/ajax/two_factor/"
          ),
          page.click("form > div:nth-child(2) > button"),
        ])
      )[0]

      if (authenticationResponse.status() == 200) break
      else console.log("Wrong verification code.")
    }
  })
}

async function login(page: Page, username: string) {
  const password = await read({ prompt: "Enter Password: ", silent: true, replace: "•" })

  // Already in login page
  await page.type('input[name="username"]', username, { delay: randomDelay() })
  await page.type('input[name="password"]', password, { delay: randomDelay() })
  // Register waitForNavigation() first, then trigger navigation
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')])

  // If Instagram displayed a rate limit message, exit earlier
  // <p aria-atomic="true" data-testid="login-error-message" id="slfErrorAlert" role="alert">Please wait a few minutes before you try again.</p>
  page
    .waitForSelector('p[data-testid="login-error-message"]')
    .then(() => {
      throw Errors["RATE_LIMIT_REACHED"]
    })
    // Under normal executions, browser will be closed while this promise is still waiting
    // thus ProtocolError will be thrown
    .catch(error => {
      if (error.name != "ProtocolError") throw error
    })

  // Ask for security code if two-factor authentication is enabled for the account
  if (new URL(page.url()).pathname == "/accounts/login/two_factor") {
    await readAndInputVerificationCode(page)
  }

  // Skip "Save Your Login Info?" page, if it is displayed
  if (new URL(page.url()).pathname == "/accounts/onetap/") {
    // Press "Not Now" button
    await page.click("main section button")
  }
}

async function extractPostsFromAPIResponse(
  page: Page,
  collectionUrl: string,
  postsSavedFromLastRun: ReadonlyDeep<Post[]>
): Promise<RawPost[]> {
  return new Promise<InstagramResponse[]>(async (resolve, reject) => {
    const last10SavedPostPk = postsSavedFromLastRun.slice(-10).map(post => post.pk)
    const responses: InstagramResponse[] = []

    // ProtocolError will be thrown,
    // if the "finally" cleanup function being executed (the promise is either resolved or rejected)
    // before all the actions (goto, evaluate, waitFor) we requested are executed
    try {
      // Capture XHR responses
      page.on("response", async response => {
        if (!new URL(response.request().url()).pathname.match(/\/api\/v1\/feed\/(?:saved|collection\/\d+)\/posts\//)) {
          return
        }

        const json: InstagramResponse | null = await response.json().catch(() => null)

        if (json == null) return
        responses.push(json)
        replaceLine(`Getting posts from Instagram... (page ${responses.length})`)

        // If this is the first incoming response,
        // and the first post in the response is the last post saved in last run
        if (responses.length == 1 && last(last10SavedPostPk) == last(rawPostsFrom(responses))!.pk) {
          reject(Errors["NO_NEW_POST"])
        }

        // If this is not the first run
        if (postsSavedFromLastRun.length != 0) {
          // The promise exits here
          // if found the last 10 posts saved from last run
          // in order to avoid unnecessarily fetching posts that are already saved to the data file
          if (last10SavedPostPk.find(lastSavedPostPk => json.items.find(post => post.media.pk == lastSavedPostPk))) {
            resolve(responses)
          }
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
      await page.waitForSelector('article [data-visualcompletion="loading-state"]', { hidden: true })

      // Fetched the whole collection, yet didn't found the last post saved from last run
      resolve(responses)
    } catch (error: any) {
      if (error.name != "ProtocolError") throw error
    }
  }).then(responses => {
    replaceLine(`Getting posts from Instagram... Done (${responses.length} pages) \n`)
    return rawPostsFrom(responses)
  })
}

export async function fetchNewPosts(
  collectionUrl: string,
  postsSavedFromLastRun: ReadonlyDeep<Post[]>,
  openWindow: boolean
): Promise<RawPost[]> {
  const userDataDir = resolve(dirname(import.meta.url.replace(/^file:\/\/\//, "")), "../puppeteer-user-data")
  const username = parseCollectionUrl(collectionUrl).username

  const browser = await puppeteer.launch({
    headless: !openWindow,
    userDataDir: userDataDir,
    args: [`--profile-directory=${username}`],
  })

  const page = await browser.newPage()
  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  page.setDefaultTimeout(0)

  try {
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle0" })
    // Wait for homepage to load
    await page.waitForSelector("main")

    if ((await page.$("#loginForm")) != null) {
      printLine("Logging in...")
      await login(page, username)
      replaceLine("Logging in... Done\n")
    } else {
      console.log("Already logged in")
    }

    const rawPosts = await extractPostsFromAPIResponse(page, collectionUrl, postsSavedFromLastRun)
    const firstNewPostIndex = findFirstNewPostIndex(rawPosts, postsSavedFromLastRun)

    return rawPosts.slice(firstNewPostIndex)
  } finally {
    await browser.close()
  }
}

export async function downloadMedias(mediaSources: ReadonlyDeep<MediaSource[]>) {
  let downloadedCount = 0

  const downloadQueue = queue<MediaSource>(async media => {
    if (media.type == "image" || media.type == "video") {
      const filename = `${media.code}.${media.type == "image" ? "jpg" : "mp4"}`
      await download(media.url, join(MEDIA_FOLDER, filename))
    } else {
      await Promise.all(media.urls.map(url => download(url, join(MEDIA_FOLDER, `${media.code}`))))
    }

    downloadedCount++
    replaceLine(`Fetching media... ${downloadedCount}/${mediaSources.length}`)
  }, 10)

  downloadQueue.push(Array.from(mediaSources))
  await downloadQueue.drain()

  replaceLine("Fetching media... Done\n")
  if (downloadedCount != mediaSources.length) {
    console.log(`${mediaSources.length - downloadedCount} Posts failed to download`)
  }
}
