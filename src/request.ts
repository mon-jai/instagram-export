import { join } from "path"
import { URL } from "url"

import { queue } from "async"
import { last } from "lodash-es"
import puppeteer, { Page } from "puppeteer"
import read from "read"
import { ReadonlyDeep } from "type-fest"

import { MEDIA_FOLDER } from "./constants.js"
import { Errors, InstagramResponse, MediaSource, Post, RawPost } from "./types.js"
import { download, printLine, randomDelay, rawPostsFrom, replaceLine } from "./utils.js"

async function login(page: Page, auth: { username: string; password: string }) {
  // Navigate to login page
  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle0" })
  await page.type('input[name="username"]', auth.username, { delay: randomDelay() })
  await page.type('input[name="password"]', auth.password, { delay: randomDelay() })
  await Promise.all([
    // Register waitForNavigation() first, then trigger navigation
    page.waitForNavigation(),
    page.evaluate(() => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click()),
  ])

  // If Instagram displayed a rate limit message, exit earlier
  // <p aria-atomic="true" data-testid="login-error-message" id="slfErrorAlert" role="alert">Please wait a few minutes before you try again.</p>
  page
    .waitForSelector('p[data-testid="login-error-message"]')
    .then(() => {
      throw Errors["RATE_LIMIT_REACHED"]
    })
    // Under normal executions, browser will be closed while this promise is still waiting
    // thus ProtocolError will be thrown
    .catch(() => {})

  // Ask for security code if two-factor authentication is enabled for the account
  if (new URL(page.url()).pathname == "/accounts/login/two_factor") {
    const verificationCodeMessageEl = (await page.waitForSelector("#verificationCodeDescription"))!
    const verificationCodeMessage = (await verificationCodeMessageEl.evaluate(el => el.textContent))!
      .trim()
      .replace("we", "Instagram")
      .replace(/.$/, ": ")

    let verificationCode: string
    do {
      verificationCode = (await read({ prompt: verificationCodeMessage })).replace(/\s/g, "")
    } while (/^\d{6}$/.test(verificationCode) == false)

    await page.type('input[name="verificationCode"]', verificationCode, { delay: randomDelay() })
    await Promise.all([
      page.waitForNavigation(),
      page.evaluate(() => (document.querySelector("form > div:nth-child(2) > button") as HTMLButtonElement).click()),
    ])
  }

  // Skip "Save Your Login Info?" page, if it is displayed
  if (new URL(page.url()).pathname == "/accounts/onetap/") {
    // Press "Not Now" button
    await page.evaluate(() => document.querySelector<HTMLElement>('main div > div > button[type="button"]')?.click())
  }
}

async function logout(page: Page) {
  await page.click('nav span[role="link"]')
  await page.click('nav hr + [role="button"]')
}

async function extractPostsFromPage(
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
        if (!new URL(response.request().url()).pathname.match(/\/api\/v1\/feed\/collection\/\d+\/posts\//)) {
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

        // The promise exits here
        // if this is not the first run and we found the last 10 posts saved from last run
        // in order to avoid unnecessarily fetching posts that are already saved to the data file
        if (
          postsSavedFromLastRun.length != 0 &&
          last10SavedPostPk.find(lastSavedPostPk => json.items.find(post => post.media.pk == lastSavedPostPk))
        ) {
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
  }).then(responses => {
    replaceLine(`Getting posts from Instagram... Done (${responses.length} pages) \n`)
    return rawPostsFrom(responses)
  })
}

function findFirstNewPostIndex(rawPosts: RawPost[], postsSavedFromLastRun: ReadonlyDeep<Post[]>) {
  // This is the first run
  if (postsSavedFromLastRun.length == 0) return 0

  const indexOfLastSavedPost = rawPosts.findIndex(rawPost => rawPost.pk == last(postsSavedFromLastRun)?.pk)

  // We found the last saved post in rawPosts
  if (indexOfLastSavedPost != -1) return indexOfLastSavedPost + 1

  // We couldn't find the last saved post
  // Look for posts saved in last run, one by one, from bottom to top
  for (const post of Array.from(postsSavedFromLastRun).reverse()) {
    const indexOfPost = rawPosts.findIndex(rawPost => rawPost.pk == post.pk)
    if (indexOfPost != -1) return indexOfPost + 1
  }

  // We couldn't find any saved post from last run
  // The whole rawPosts array will be saved (from 0 to rawPosts.length -1)
  return 0
}

export async function getNewPosts(
  collectionUrl: string,
  auth: { username: string; password: string },
  postsSavedFromLastRun: ReadonlyDeep<Post[]>
): Promise<RawPost[]> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))

  try {
    page.setDefaultTimeout(0)

    printLine("Logging in...")
    await login(page, auth)
    replaceLine("Logging in... Done\n")

    const rawPosts = await extractPostsFromPage(page, collectionUrl, postsSavedFromLastRun)
    const firstNewPostIndex = findFirstNewPostIndex(rawPosts, postsSavedFromLastRun)

    return rawPosts.slice(firstNewPostIndex)
  } finally {
    // Cleanup
    await logout(page).catch(() => {})
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
