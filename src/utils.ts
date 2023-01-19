import { writeFile } from "fs/promises"
import { basename, resolve } from "path"

import { Command } from "commander"
import { isEmpty, last, pickBy } from "lodash-es"
import { random } from "lodash-es"
import { ReadonlyDeep } from "type-fest"
import { fetch } from "undici"

import { Errors, InstagramPost, InstagramPostWithMedia, InstagramResponse, Media, MediaSource, Post } from "./types.js"

// Utility functions

function pick<T, K extends keyof T>(object: T | undefined, includedKeys: Readonly<K[]>): Pick<T, K> {
  return object == undefined
    ? {}
    : Object.fromEntries(
        Object.entries(object).map((value, key) =>
          includedKeys.includes(key as K) && value != null && value != undefined ? [key, value] : []
        )
      )
}

export function randomDelay() {
  return 100 + random(0, 150)
}

export function printLine(message: string) {
  process.stdout.write(message)
}

export function replaceLine(message: string) {
  // https://stackoverflow.com/a/59805130
  process.stdout.clearLine(-1)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

export function isValidYesNoOption(userInput: string): userInput is "Y" | "N" {
  return userInput == "Y" || userInput == "N"
}

export function parseCollectionUrl(url: string) {
  const match = url.match(
    /^https:\/\/www.instagram.com\/(?<username>[A-Za-z0-9._-]*)\/saved\/(?<collectionName>[^\/]*)\/?(?<collectionId>\d+)?\/?$/
  )

  if (match == null || match.groups == undefined) throw Errors.INVALID_COLLECTION_URL

  return {
    username: match.groups.username,
    collectionName: match.groups.collectionName,
    collectionId: match.groups.collectionId ?? "all-posts",
  }
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

  if (response.body == null) throw Errors.DOWNLOAD_FAILED

  await writeFile(resolve(path, filename), response.body)
}

// Casting functions used within this file

function getMediaUrl(media: Media) {
  if ("video_versions" in media) {
    return media.video_versions[0].url
  } else {
    return media.image_versions2.candidates[0].url
  }
}

// Casting functions used outside this file

export function postFrom(instagramPost: InstagramPost): Post {
  const userPathsToInclude = ["pk", "username", "full_name"] as const

  const { pk, id, media_type, code, location, user, caption, clips_metadata, coauthor_producers = [] } = instagramPost
  const music_info = clips_metadata?.music_info?.music_asset_info

  const post: Post = {
    pk,
    id,
    media_type,
    code,
    location: pick(location, ["pk", "short_name", "name", "address", "city", "lng", "lat"]),
    user: pick(user, userPathsToInclude),
    caption: pick(caption ?? undefined, ["pk", "text", "created_at"]),
    music_info: pick(music_info, ["title", "id", "display_artist", "artist_id", "ig_username"]),
    coauthor_producers: coauthor_producers.map(coauthor_producer => pick(coauthor_producer, userPathsToInclude)),
  }

  return pickBy(post, value => {
    if (Array.isArray(value)) return value.length > 0
    // For value equals to undefined (location) or null (caption), pick returns a empty object
    else if (typeof value == "object") return !isEmpty(value)
    else return true
  }) as Post
}

export function mediaSourceFrom(instagramPost: InstagramPostWithMedia): MediaSource {
  if ("image_versions2" in instagramPost) {
    const { code } = instagramPost
    return {
      code,
      type: "video_versions" in instagramPost ? "video" : "image",
      url: getMediaUrl(instagramPost),
    }
  } else {
    const { code, carousel_media } = instagramPost
    return {
      code,
      type: "carousel",
      urls: carousel_media.map(media => getMediaUrl(media)),
    }
  }
}

export function instagramPostsFrom(responses: ReadonlyDeep<InstagramResponse>[]) {
  // Order of responses at the beginning: [{ items: [12, 11, 10, 9] }, { items: [8, 7, 6, 5] }, { items: [4, 3, 2, 1] }]
  return responses
    .reverse() // [{ items: [4, 3, 2, 1] }, { items: [8, 7, 6, 5] }, { items: [12, 11, 10, 9] }]
    .map(result => result.items.map(item => item.media).reverse()) // [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
    .flat() // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

export function fullCommandNameFrom(command: Readonly<Command>) {
  let commandName = ""
  let currentCommand: Command | null = command

  while (currentCommand != null) {
    commandName = `${currentCommand.name()} ${commandName}`
    currentCommand = currentCommand.parent
  }

  return commandName.trim()
}
