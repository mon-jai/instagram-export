import { lstat, mkdir, readdir, writeFile } from "fs/promises"
import { basename, resolve } from "path"

import { Command, Help } from "@oclif/core"
import { IDataHeaderOrder } from "@ulixee/default-browser-emulator/interfaces/IBrowserData.js"
import _DataLoader from "@ulixee/default-browser-emulator/lib/DataLoader.js"
import _RealUserAgents from "@ulixee/real-user-agents"
import { isEmpty, last, random, startCase } from "lodash-es"
import { ReadonlyDeep } from "type-fest"
import { fetch } from "undici"
import YAML from "yaml"

import Init from "../commands/init.js"
import { DATA_FILE, MEDIA_DIRECTORY_NAME, REQUEST_HEADERS } from "./constants.js"
import {
  DataStore,
  Errors,
  IWithMedia,
  IWithMediaURL,
  InstagramPost,
  InstagramResponse,
  MediaDownloadOption,
  MediaSource,
  Post,
  User
} from "./types.js"

const DataLoader = (_DataLoader as any as { default: typeof _DataLoader }).default
const RealUserAgents = (_RealUserAgents as any as { default: typeof _RealUserAgents }).default

type IUserAgentOption = Parameters<InstanceType<typeof _DataLoader>["as"]>[0]

// Utility functions

// https://stackoverflow.com/q/47232518/
function pick<T, K extends keyof T>(object: T | null | undefined, includedKeys: Readonly<K[]>) {
  if (object === null || object === undefined) return undefined

  const result = {} as NonNullable<Pick<T, K>>

  // Maintain ordering of keys
  for (const key of includedKeys) {
    const value = object[key]
    if (!isNullableOrEmpty(value) && !(typeof value == "string" && value.length == 0)) result[key] = value
  }

  return result
}

export async function sleep(duration: number) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

export function replaceLine(message: string) {
  // https://stackoverflow.com/a/59805130
  process.stdout.clearLine(-1)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

export async function printNotInitializedMessage(command: Command) {
  console.error(
    `Current directory not initialized, make sure to initialize it with \`${command.config.bin} ${Init.id}\` before running this command\n`
  )
  await new Help(command.config).showCommandHelp(Init)
}

// https://github.com/nodejs/undici/discussions/1593#discussioncomment-3364109
export async function download(url: string, path: string, filename: string = basename(new URL(url).pathname)) {
  const headers = url.includes(".mp4") ? REQUEST_HEADERS.fetch : REQUEST_HEADERS.image
  const response = await fetch(url, { headers })
  if (response.body == null) throw Errors.DOWNLOAD_FAILED

  if (!filename.includes(".")) filename = `${filename}.${response.headers.get("Content-Type")!.split("/").pop()!}`

  await mkdir(path, { recursive: true })
  await writeFile(resolve(path, filename), response.body)
}

export async function writeData(data: DataStore, checkForEmptyValue = true) {
  const yamlString = YAML.stringify(
    data,
    checkForEmptyValue ? (_key, value) => (isNullableOrEmpty(value) ? undefined : value) : null,
    { blockQuote: "literal", collectionStyle: "block" }
  )
    .replace(/^  /gm, "")
    .replace(/^-/gm, "\n-")

  await writeFile(DATA_FILE, yamlString)
}

// Boolean functions

function isNullableOrEmpty(value: any) {
  // Include primitive values and discard empty arrays/objects
  // https://github.com/lodash/lodash/issues/3523#issuecomment-347555398
  return typeof value == "object" && isEmpty(value)
}

export function isValidDataStore(data: Partial<DataStore>): asserts data is DataStore {
  const { url, download_media, posts } = data

  if (url == undefined || download_media == undefined || posts == undefined) {
    throw Errors["NOT_INITIALIZED"]
  }
}

export function isJavaScriptFile(filePath: string) {
  // https://stackoverflow.com/a/52312133/
  return [".js", ".mjs"].some(extension => filePath.endsWith(extension))
}

// Getter functions

export function getChromeDefaultHeaders() {
  const operatingSystemName = "windows"
  const operatingSystemVersion = { major: "11" }
  const operatingSystemId = `${operatingSystemName}-${operatingSystemVersion.major}`

  const dataLoader = new DataLoader()
  const browserEngineOption = dataLoader.browserEngineOptions[0]
  const userAgentOption: IUserAgentOption = {
    browserName: browserEngineOption.name,
    browserVersion: { major: browserEngineOption.majorVersion.toString(), minor: "0" },
    operatingSystemName,
    // @ts-expect-error
    operatingSystemVersion
  }
  const browserId = browserEngineOption.id

  const { headers } = dataLoader.as(userAgentOption)
  const userAgentString = RealUserAgents.where({ browserId, operatingSystemId })[0].pattern

  return {
    image: headersFrom(headers.https.Image[0], userAgentString),
    fetch: headersFrom(
      headers.https.Fetch.find(header => header.method == "GET" && header.originTypes.includes("cross-site"))!,
      userAgentString
    )
  }
}

export function getRandomTypingDelay() {
  return random(100, 250)
}

export function getFirstNewPostIndex(
  instagramPosts: ReadonlyDeep<InstagramPost[]>,
  postsSavedFromLastRun: ReadonlyDeep<Post[]>
) {
  // This is the first run
  if (postsSavedFromLastRun.length == 0) return 0

  const indexOfLastSavedPost = instagramPosts.findIndex(
    instagramPost => instagramPost.pk == last(postsSavedFromLastRun)?.pk
  )

  // We found the last saved post in instagramPosts
  if (indexOfLastSavedPost != -1) return indexOfLastSavedPost + 1

  // We couldn't find the last saved post
  // Look for posts saved in last run, one by one, from bottom to top
  for (const post of Array.from(postsSavedFromLastRun).reverse()) {
    const indexOfPost = instagramPosts.findIndex(instagramPost => instagramPost.pk == post.pk)
    if (indexOfPost != -1) return indexOfPost + 1
  }

  // We couldn't find any saved post from last run
  // The whole instagramPosts array will be saved (from 0 to instagramPosts.length -1)
  return 0
}

export async function getMediaPaths(posts: ReadonlyDeep<Post[]>) {
  const mediaFolder = resolve("media")
  const medias = await readdir(mediaFolder).catch(() => null)
  if (medias == null) return Object.fromEntries(posts.map(post => [post.code, []]))

  return Object.fromEntries<string[]>(
    await Promise.all(
      posts.map(async (post): Promise<[string, string[]]> => {
        const postFolder = resolve(mediaFolder, post.code)
        let mediaFiles

        if (medias.includes(post.code) && (await lstat(postFolder)).isDirectory()) {
          mediaFiles = (await readdir(postFolder)).map(file => `${post.code}/${file}`)
        } else {
          const mediaFile =
            medias.find(file => file == `${post.code}.mp4`) ?? medias.find(file => file.startsWith(post.code))
          mediaFiles = mediaFile != undefined ? [mediaFile] : []
        }

        return [post.code, mediaFiles.map(mediaFile => `/${MEDIA_DIRECTORY_NAME}/${mediaFile}`)]
      })
    )
  )
}

// Cast/extract functions

function headersFrom({ order, defaults }: IDataHeaderOrder, userAgentString: string) {
  const headers = new Headers()
  const additionalHeaders: Record<string, string> = {
    "User-Agent": userAgentString,
    Origin: "https://www.instagram.com",
    Referer: "https://www.instagram.com/"
  }

  for (const name of order) {
    const value = name in defaults ? defaults[name][0] : name in additionalHeaders ? additionalHeaders[name] : null
    if (value != null) headers.set(name, value)
  }

  return headers
}

function userFrom(instagramUser: { pk: string; username: string; full_name: string }) {
  return pick(instagramUser, ["pk", "username", "full_name"])! satisfies User
}

function mediaUrlFrom(media: IWithMediaURL) {
  if ("video_versions" in media) {
    return media.video_versions[0].url
  } else {
    return media.image_versions2.candidates[0].url
  }
}

export function archiveInfoFrom(archiveUrl: string) {
  const pathname = new URL(archiveUrl).pathname

  const match =
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/?$/) ??
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/saved\/(?<collectionName>all-posts)\/?$/) ??
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/saved\/(?<collectionName>[^\/]+)\/\d+\/?$/)

  if (match == null || match.groups == undefined) throw Errors.INVALID_COLLECTION_URL
  return {
    username: match.groups.username,
    archiveName: match.groups.collectionName
      ? startCase(match.groups.collectionName.replaceAll("-", " "))
      : match.groups.username
  }
}

export function instagramPostsFrom(responses: ReadonlyDeep<InstagramResponse>[]) {
  // Order of responses at the beginning: [{ items: [12, 11, 10, 9] }, { items: [8, 7, 6, 5] }, { items: [4, 3, 2, 1] }]
  return responses
    .reverse() // [{ items: [4, 3, 2, 1] }, { items: [8, 7, 6, 5] }, { items: [12, 11, 10, 9] }]
    .map(result => result.items.map(item => ("media" in item ? item.media : item)).reverse()) // [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
    .flat() // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

export function postFrom(instagramPost: InstagramPost): Post {
  const {
    pk,
    id,
    code,
    taken_at,
    user,
    coauthor_producers,
    usertags,
    caption,
    location: instagramLocation,
    clips_metadata
  } = instagramPost

  const location = pick(instagramLocation, ["pk", "short_name", "name", "address", "city", "lng", "lat"])
  const music_info = pick(
    clips_metadata?.music_info?.music_asset_info, //
    ["audio_cluster_id", "id", "title", "display_artist", "artist_id", "ig_username"]
  )

  return {
    pk,
    id,
    code,
    taken_at,
    user: userFrom(user),
    coauthor_producers: coauthor_producers?.map(coauthor_producer => userFrom(coauthor_producer)) ?? [],
    tagged_user: usertags?.in.map(({ user }) => userFrom(user)) ?? [],
    ...(location != undefined ? { location } : {}),
    ...(music_info != undefined ? { music_info } : {}),
    caption: caption?.text ?? ""
  }
}

export function mediaSourceFrom(instagramPost: IWithMedia, downloadOption: MediaDownloadOption): MediaSource {
  if (downloadOption == "thumbnail") {
    const { code, image_versions2 } = instagramPost
    return {
      code: code,
      type: "image",
      url: mediaUrlFrom({ image_versions2 })
    }
  } else if ("carousel_media" in instagramPost) {
    const { code, carousel_media } = instagramPost
    return {
      code,
      type: "carousel",
      urls: carousel_media.map(media => mediaUrlFrom(media))
    }
  } else {
    const { code } = instagramPost
    return {
      code,
      type: "video_versions" in instagramPost ? "video" : "image",
      url: mediaUrlFrom(instagramPost)
    }
  }
}
