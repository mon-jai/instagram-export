import { basename, dirname, resolve } from "path"
import { URL, fileURLToPath } from "url"

import { queue, retry } from "async"
import inquirer from "inquirer"
import { last, random } from "lodash-es"
import puppeteer, { Page } from "puppeteer"
import { ReadonlyDeep } from "type-fest"

import { MEDIA_FOLDER } from "./constants.js"
import { Errors, InstagramPost, InstagramResponse, MediaSource, Post } from "./types.js"
import {
  archiveInfoFrom,
  download,
  getFirstNewPostIndex,
  getRandomTypingDelay,
  instagramPostsFrom,
  replaceLine,
  sleep
} from "./utils.js"

async function readAndInputVerificationCode(page: Page) {
  const verificationCodeInputSelector = 'input[name="verificationCode"]'
  const verificationCodeMessageEl = (await page.waitForSelector("#verificationCodeDescription"))!
  const verificationCodeMessage = (await verificationCodeMessageEl.evaluate(el => el.textContent))!
    .trim()
    .replace("we", "Instagram")
    .replace(/.$/, ":")

  return new Promise(async resolve => {
    const transformInput = (input: string) => input.replace(/[^\d]/g, "")

    // Exit point
    page.waitForNavigation().then(resolve)

    await inquirer.prompt({
      name: "verificationCode",
      message: verificationCodeMessage,
      type: "input",

      transformer: transformInput,

      async validate(input: string) {
        const verificationCode = transformInput(input)

        if (/^\d{6}$/.test(verificationCode) == false) {
          return "Verification code must contains 6 digits."
        }

        // Clear previous input, https://stackoverflow.com/a/52633235
        await page.click(verificationCodeInputSelector)
        while ((await page.$eval(verificationCodeInputSelector, el => el.value.length)) > 0) {
          await page.keyboard.press("Backspace", { delay: getRandomTypingDelay() })
        }
        await page.type(verificationCodeInputSelector, verificationCode, { delay: getRandomTypingDelay() })

        const authenticationResponse = (
          await Promise.all([
            page.waitForResponse(
              response => new URL(response.url()).pathname == "/api/v1/web/accounts/login/ajax/two_factor/"
            ),
            page.click("form > div:nth-child(2) > button")
          ])
        )[0]

        if (authenticationResponse.status() == 200) return true
        else return "Wrong verification code."
      }
    })
  })
}

async function login(page: Page, username: string) {
  console.log("Logging in...")

  const password = (
    await inquirer.prompt({ name: "password", message: "Enter Password:", type: "password", mask: "•" })
  ).password as string

  // Already in login page
  await page.type('input[name="username"]', username, { delay: getRandomTypingDelay() })
  await page.type('input[name="password"]', password, { delay: getRandomTypingDelay() })
  // Register waitForNavigation() first, then trigger navigation
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')])

  // If Instagram displayed a rate limit message, exit earlier
  // <p aria-atomic="true" data-testid="login-error-message" id="slfErrorAlert" role="alert">Please wait a few minutes before you try again.</p>
  page
    .waitForSelector('p[data-testid="login-error-message"]')
    .then(() => {
      throw Errors["RATE_LIMIT_REACHED"]
    })
    .catch(error => {
      // Under normal executions, browser will be closed while this promise is still waiting
      // thus TargetCloseError will be thrown
      if (error.name != "TargetCloseError") throw error
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

  console.log("Logging in... Done")
}

async function scrollToBottomInfinitely(page: Page) {
  try {
    while (true) {
      await page.mouse.wheel({ deltaY: 120 })

      // If the page is scrolled to the bottom
      if (await page.evaluate(() => window.scrollY == document.documentElement.scrollHeight - window.innerHeight)) {
        await sleep(random(3000, 5000))
      } else {
        await sleep(random(20, 50))
      }
    }
  } catch {}
}

async function extractPostsFromAPIResponse(
  page: Page,
  collectionUrl: string,
  postsSavedFromLastRun: ReadonlyDeep<Post[]>,
  maxPage: number
): Promise<InstagramPost[]> {
  return new Promise<InstagramResponse[]>(async (resolve, reject) => {
    const last10SavedPostPk = postsSavedFromLastRun.slice(-10).map(post => post.pk)
    const responses: InstagramResponse[] = []

    // ProtocolError will be thrown,
    // if the "finally" cleanup function being executed (the promise is either resolved or rejected)
    // before all the actions (goto, evaluate, waitFor) we requested are executed
    try {
      // Capture XHR responses
      page.on("response", async response => {
        // "/api/v1/feed/user/{user_id}/"
        // "/api/v1/feed/saved/posts/"
        // "/api/v1/feed/collection/{collection_id}/posts/"
        if (
          !new URL(response.request().url()).pathname.match(
            /^\/api\/v1\/feed\/(?:user\/\d+|saved\/posts|collection\/\d+\/posts)\/$/
          )
        ) {
          return
        }

        const json: InstagramResponse | null = await response.json().catch(() => null)

        if (json == null) return
        responses.push(json)
        replaceLine(`Fetching posts from Instagram... (page ${responses.length})`)

        // If this is the first incoming response,
        // and the first post in the response is the last post saved in last run
        if (responses.length == 1 && last(last10SavedPostPk) == last(instagramPostsFrom(responses))!.pk) {
          reject(Errors["NO_NEW_POST"])
        }

        if (responses.length == maxPage) {
          resolve(responses)
        }

        if (
          // If this is not the first run, and
          postsSavedFromLastRun.length != 0 &&
          // We found one of the last 10 posts saved from the last run
          // https://github.com/microsoft/TypeScript/issues/44373, https://github.com/microsoft/TypeScript/issues/36390#issuecomment-641718624
          last10SavedPostPk.find(lastSavedPostPk =>
            (json.items as any[]).find(post => (post.media?.pk ?? post.pk) == lastSavedPostPk)
          )
        ) {
          // Avoid unnecessarily fetching posts that have already been saved to the data file.
          resolve(responses)
        }
      })

      // Navigate to collection page
      await page.goto(collectionUrl)
      // Wait until the first image being loaded
      // Spinner might not be mounted to DOM if the collection has too few items therefore looking for it may stuck the crawler
      await page.waitForSelector("main article a img")
      // Scroll to bottom to load old posts
      scrollToBottomInfinitely(page)

      // Wait until all posts are loaded (hence the spinner is removed from DOM)
      // There are two spinner elements that will be mounted to DOM
      // both of them are indirect children of `main` but only the second one get mounted is a indirect child of `article`
      await page.waitForSelector('article [data-visualcompletion="loading-state"]', { hidden: true, timeout: 0 })

      // Fetched the whole collection, yet didn't found the last post saved from last run
      resolve(responses)
    } catch (error: any) {
      if (error.name != "TargetCloseError") throw error
    }
  }).then(responses => {
    replaceLine(`Getting posts from Instagram... Done (${responses.length} pages) \n`)
    return instagramPostsFrom(responses)
  })
}

export async function fetchNewPosts(
  collectionUrl: string,
  postsSavedFromLastRun: ReadonlyDeep<Post[]>,
  openWindow: boolean,
  maxPage: number
): Promise<InstagramPost[]> {
  const userDataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../puppeteer-user-data")
  const { username } = archiveInfoFrom(collectionUrl)

  const browser = await puppeteer.launch({
    headless: !openWindow,
    userDataDir: userDataDir,
    args: [`--profile-directory=${username}`],
    // ProtocolError: ... Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed.
    // https://github.com/puppeteer/puppeteer/issues/9927#issuecomment-1486670812
    protocolTimeout: 0
  })

  const page = await browser.newPage()
  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  page.setDefaultTimeout(0)

  try {
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle0" })
    // Wait for homepage to load
    await page.waitForSelector("main")

    if ((await page.$("#loginForm")) != null) await login(page, username)
    else console.log("Already logged in")

    const rawPosts = await extractPostsFromAPIResponse(page, collectionUrl, postsSavedFromLastRun, maxPage)
    const firstNewPostIndex = getFirstNewPostIndex(rawPosts, postsSavedFromLastRun)

    return rawPosts.slice(firstNewPostIndex)
  } finally {
    await browser.close()
  }
}

export async function downloadMedias(mediaSources: ReadonlyDeep<MediaSource[]>) {
  let downloadedCount = 0

  const downloadQueue = queue<MediaSource>(async media => {
    return retry(10, async () => {
      if (media.type == "image" || media.type == "video") {
        await download(media.url, MEDIA_FOLDER, media.code)
      } else {
        await Promise.all(
          media.urls.map((url, index) =>
            download(url, resolve(MEDIA_FOLDER, media.code), `${index + 1}_${basename(new URL(url).pathname)}`)
          )
        )
      }

      downloadedCount++
      replaceLine(`Fetching media... ${downloadedCount}/${mediaSources.length}`)
    })
  }, 10)

  downloadQueue.push(Array.from(mediaSources))
  await downloadQueue.drain()

  replaceLine("Fetching media... Done\n")
  if (downloadedCount != mediaSources.length) {
    console.log(`${mediaSources.length - downloadedCount} posts failed to download.`)
  }
}
