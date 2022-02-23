import { join } from "path"
import { URL } from "url"

import { queue } from "async"
import download from "download"
import { last, random } from "lodash-es"
import puppeteer, { Page } from "puppeteer"
import { ReadonlyDeep } from "type-fest"

import { Errors, InstagramResponse, MediaSource, Post, RawPost } from "./types.js"
import { printLine, rawPostsFrom, replaceLine } from "./utils.js"

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
      throw Errors["RATE_LIMIT_REACHED"]
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
          reject(Errors["NO_NEW_PHOTO"])
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

async function withPage<T extends Record<string, any>>(
  callback: (page: Page) => Promise<T>,
  complete?: () => void | Promise<void>
): Promise<T> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  page.setDefaultTimeout(0)

  return (
    new Promise<T>(async resolve => resolve(await callback(page)))
      // Cleanup
      .finally(async () => {
        if (complete != undefined) await complete()
        await browser.close()
      })
  )
}

// Get new posts in a collection
export async function getNewPosts(
  collectionUrl: string,
  auth: { username: string; password: string },
  postsSavedFromLastRun: ReadonlyDeep<Post[]>
): Promise<ReadonlyDeep<RawPost[]>> {
  return withPage(
    async page => {
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
    },
    () => replaceLine("Getting posts from Instagram... Done\n")
  )
}

// Get post data of a post
export async function getPost(url: string): Promise<RawPost> {
  const code = new URL(url).pathname.match(/^\/p\/(?<code>[A-z0-9]+)\/?$/)?.groups?.code

  if (typeof code != "string") throw ""

  return withPage(async page => {
    await page.setJavaScriptEnabled(false)
    await page.goto(url)
    const rawPost = await page.$$eval("script", scripts => {
      const scriptTagInnerText = (scripts as HTMLScriptElement[]).find(
        script => script.innerText.includes("window.__additionalDataLoaded") && script.innerText.includes(code)
      )?.innerText as string
      return JSON.parse(scriptTagInnerText.match(/(\{.*\} *)/)?.[0] ?? "{}")
    })
    return rawPost
  })
}

export async function downloadMedias(mediaSources: ReadonlyDeep<MediaSource[]>) {
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
