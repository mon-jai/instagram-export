import { writeFile } from "fs/promises"
import { basename, resolve } from "path"

import { Command, Help } from "@oclif/core"
import { isEmpty, last, random, startCase } from "lodash-es"
import { ReadonlyDeep } from "type-fest"
import { fetch } from "undici"

import Init from "../commands/init.js"
import {
  DownloadOption,
  Errors,
  IWithMedia,
  IWithMediaURL,
  InstagramPost,
  InstagramResponse,
  MediaSource,
  Post,
  User
} from "./types.js"

// Utility functions

// https://stackoverflow.com/questions/47232518/write-a-typesafe-pick-function-in-typescript
function pick<T, K extends keyof T>(object: T | null | undefined, includedKeys: Readonly<K[]>) {
  if (object === null || object === undefined) return undefined

  const result = {} as NonNullable<Pick<T, K>>

  // Maintain ordering of keys
  for (const key of includedKeys) {
    const value = object[key]
    if (!isNullableOrEmpty(value)) result[key] = value
  }

  return result
}

function getMediaUrl(media: IWithMediaURL) {
  if ("video_versions" in media) {
    return media.video_versions[0].url
  } else {
    return media.image_versions2.candidates[0].url
  }
}

export function randomDelay() {
  return 100 + random(0, 150)
}

export function replaceLine(message: string) {
  // https://stackoverflow.com/a/59805130
  process.stdout.clearLine(-1)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

export function parseArchiveUrl(url: string) {
  const pathname = new URL(url).pathname

  const match =
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/?$/) ??
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/saved\/(?<collectionName>all-posts)\/?$/) ??
    pathname.match(/^\/(?<username>[A-Za-z0-9._-]+)\/saved\/(?<collectionName>[^\/]+)\/\d+\/?$/)

  if (match === null || match.groups === undefined) throw Errors.INVALID_COLLECTION_URL

  return {
    username: match.groups.username,
    archiveName: match.groups.collectionName
      ? startCase(match.groups.collectionName.replaceAll("-", " "))
      : match.groups.username
  }
}

export function isNullableOrEmpty(value: any) {
  // Include primitive values and discard empty arrays/objects
  // https://github.com/lodash/lodash/issues/3523#issuecomment-347555398
  return typeof value == "object" && isEmpty(value)
}

export async function printNotInitializedMessage(command: Command) {
  console.error(
    `Current directory not initialized, make sure to initialize it with \`${command.config.bin} ${Init.id}\` before running this command\n`
  )
  await new Help(command.config).showCommandHelp(Init)
}

export function findFirstNewPostIndex(
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

// https://github.com/nodejs/undici/discussions/1593#discussioncomment-3364109
export async function download(url: string, path: string, filename: string = basename(new URL(url).pathname)) {
  const response = await fetch(url)

  if (response.body === null) throw Errors.DOWNLOAD_FAILED

  await writeFile(resolve(path, filename), response.body)
}

// Casting functions

function userFrom(instagramUser: { pk: string; username: string; full_name: string }) {
  return pick(instagramUser, ["pk", "username", "full_name"]) as User
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
    ...(location !== undefined ? { location } : {}),
    ...(music_info !== undefined ? { music_info } : {}),
    caption: caption?.text ?? ""
  }
}

export function mediaSourceFrom(instagramPost: IWithMedia, downloadOption: DownloadOption): MediaSource {
  if ("carousel_media" in instagramPost && downloadOption != "thumbnail") {
    const { code, carousel_media } = instagramPost
    return {
      code,
      type: "carousel",
      urls: carousel_media.map(media => getMediaUrl(media))
    }
  } else if (downloadOption == "thumbnail") {
    const { code, image_versions2 } = instagramPost
    return {
      code: code,
      type: "image",
      url: getMediaUrl({ image_versions2 })
    }
  } else {
    const { code } = instagramPost
    return {
      code,
      type: "video_versions" in instagramPost ? "video" : "image",
      url: getMediaUrl(instagramPost)
    }
  }
}

export function instagramPostsFrom(responses: ReadonlyDeep<InstagramResponse>[]) {
  // Order of responses at the beginning: [{ items: [12, 11, 10, 9] }, { items: [8, 7, 6, 5] }, { items: [4, 3, 2, 1] }]
  return responses
    .reverse() // [{ items: [4, 3, 2, 1] }, { items: [8, 7, 6, 5] }, { items: [12, 11, 10, 9] }]
    .map(result => result.items.map(item => ("media" in item ? item.media : item)).reverse()) // [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
    .flat() // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}
