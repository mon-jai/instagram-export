import { writeFile } from "fs/promises"

import { Command } from "commander"
import { isEmpty, pick, pickBy } from "lodash-es"
import { random } from "lodash-es"
import { ReadonlyDeep } from "type-fest"
import { fetch } from "undici"

import { Errors, InstagramResponse, Media, MediaSource, Post, RawPost } from "./types.js"

// Utility functions

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

// https://github.com/nodejs/undici/discussions/1593#discussioncomment-3364109
export async function download(url: string, path: string) {
  const res = await fetch(url)

  if (res.body == null) throw Errors.DOWNLOAD_FAILED

  await writeFile(path, res.body)
}

export function isValidYesNoOption(userInput: string): userInput is "Y" | "N" {
  return userInput == "Y" || userInput == "N"
}

// Casting functions used within this file

function getUrl(media: Media) {
  if ("video_versions" in media) {
    return media.video_versions[0].url
  } else {
    return media.image_versions2.candidates[0].url
  }
}

// Casting functions used outside this file

export function postFrom(rawPost: RawPost): Post {
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

export function mediaSourceFrom(rawPost: RawPost): MediaSource {
  if ("image_versions2" in rawPost) {
    return {
      code: rawPost.code,
      type: "video_versions" in rawPost ? "video" : "image",
      url: getUrl(rawPost),
    }
  } else {
    const { code, carousel_media } = rawPost
    return {
      code: code,
      type: "carousel",
      urls: carousel_media.map(media => getUrl(media)),
    }
  }
}

export function rawPostsFrom(responses: ReadonlyDeep<InstagramResponse>[]) {
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
