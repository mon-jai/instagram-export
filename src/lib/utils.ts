import { writeFile } from "fs/promises"
import { basename, resolve } from "path"

import { Command, Help } from "@oclif/core"
import { isEmpty, last, pickBy, startCase } from "lodash-es"
import { random } from "lodash-es"
import html from "string-dedent"
import { ReadonlyDeep } from "type-fest"
import { fetch } from "undici"

import Init from "../commands/init.js"
import { Errors, IWithMedia, IWithMediaURL, InstagramPost, InstagramResponse, MediaSource, Post } from "./types.js"

// Utility functions

// https://stackoverflow.com/questions/47232518/write-a-typesafe-pick-function-in-typescript
function pick<T, K extends keyof T>(
  object: T | null | undefined,
  includedKeys: Readonly<K[]>
): NonNullable<Pick<T, K>> {
  return object != null && object != undefined
    ? Object.fromEntries(
        Object.entries(object).map(([key, value]) =>
          includedKeys.includes(key as K) && value != null && value != undefined && value != "" ? [key, value] : []
        )
      )
    : {}
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

  if (match == null || match.groups == undefined) throw Errors.INVALID_COLLECTION_URL

  return {
    username: match.groups.username,
    archiveName: match.groups.collectionName
      ? startCase(match.groups.collectionName.replaceAll("-", " "))
      : match.groups.username,
  }
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

  if (response.body == null) throw Errors.DOWNLOAD_FAILED

  await writeFile(resolve(path, filename), response.body)
}

// Casting functions

function userFrom(instagramUser: { pk: string; username: string; full_name: string }) {
  return pick(instagramUser, ["pk", "username", "full_name"])
}

export function postFrom(instagramPost: InstagramPost): Post {
  const {
    pk,
    taken_at,
    id,
    code,
    location,
    user,
    caption,
    clips_metadata,
    coauthor_producers = [],
    usertags,
  } = instagramPost

  const music_info = clips_metadata?.music_info?.music_asset_info

  const post: Post = {
    pk,
    id,
    code,
    taken_at,
    user: userFrom(user),
    coauthor_producers: coauthor_producers.map(coauthor_producer => userFrom(coauthor_producer)),
    tagged_user: usertags?.in.map(({ user }) => userFrom(user)) ?? [],
    caption: caption?.text || "",
    location: pick(location, ["pk", "short_name", "name", "address", "city", "lng", "lat"]),
    music_info: pick(music_info, ["title", "id", "display_artist", "artist_id", "ig_username"]),
  }

  return pickBy(post, value => {
    if (Array.isArray(value)) return value.length > 0
    // For value equals to undefined (location) or null (caption), pick returns a empty object
    else if (typeof value == "object") return !isEmpty(value)
    else if (typeof value == "string") return value.length != 0
    else return true
  }) as Post
}

export function mediaSourceFrom(instagramPost: IWithMedia): MediaSource {
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
    .map(result => result.items.map(item => ("media" in item ? item.media : item)).reverse()) // [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
    .flat() // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

export function postsHTMLFrom(archiveName: string, posts: Post[], mediaPaths: (string | undefined)[][] | null) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${archiveName}</title>

        <link href="https://esm.sh/@primer/css@20/dist/primer.css" rel="stylesheet" />
        <link href="https://esm.sh/@primer/css@20/dist/base.css" rel="stylesheet" />
        <link href="https://esm.sh/@primer/css@20/dist/markdown.css" rel="stylesheet" />

        <link rel="stylesheet" href="https://esm.sh/swiper@8/swiper.min.css" />
        <link rel="stylesheet" href="https://esm.sh/swiper@8/modules/navigation/navigation.min.css" />
        <link rel="stylesheet" href="https://esm.sh/swiper@8/modules/pagination/pagination.min.css" />

        <style>
          body {
            margin: 0;
          }

          #app {
            display: flex;
            height: 100vh;
          }

          .grid {
            width: 50%;
            max-width: 935px;
            padding: 52px;
            border-right: 1px solid rgb(219, 219, 219);

            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 28px;

            overflow: auto;
          }

          .grid-item {
            padding-top: 100%;
            border: 1px solid rgb(219, 219, 219);
            position: relative;

            border-radius: 4px;
            overflow: hidden;
          }

          .grid-media,
          .grid-placeholder,
          .grid-item.active:after {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
          }

          .grid-item.active:after {
            content: "";
            background-image: linear-gradient(to top, rgba(38, 38, 38, 0.6), rgba(255, 255, 255, 0));
          }

          .grid-media {
            object-fit: cover;
          }

          .grid-placeholder {
            font-size: 5rem;
            background: rgb(239, 239, 239);

            display: flex;
            align-items: center;
            justify-content: center;
          }

          .info {
            padding: 52px;
            flex: 1;

            display: flex;
            flex-direction: column;

            overflow: auto;
          }

          .swiper {
            width: 100%;
            height: 50%;

            flex-shrink: 0;
            /* Vertically center, https://stackoverflow.com/a/33455342 */
            margin-top: auto;

            background-color: #262626;
          }

          .swiper img,
          .swiper video {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .swiper-button-prev:after,
          .swiper-button-next:after {
            color: white;
          }

          .swiper-pagination-bullet {
            background-color: white;
            opacity: 0.4;
          }

          .swiper-pagination-bullet-active {
            opacity: 1;
          }

          .markdown-body {
            margin-top: 52px;
            /* Vertically center, https://stackoverflow.com/a/33455342 */
            margin-bottom: auto;
          }

          /* mediaPaths == null */
          .markdown-body:first-child {
            /* Vertically center, https://stackoverflow.com/a/33455342 */
            margin-top: auto;
          }

          .markdown-body table {
            display: table;
            width: 100%;
          }

          .markdown-body table table {
            margin: 0;
          }

          td {
            /* Preserve line break in json data */
            white-space: pre-wrap;
          }

          td:first-child {
            /* https://stackoverflow.com/a/26983473 */
            width: 1%;
            white-space: nowrap;
          }
        </style>
      </head>

      <body>
        <div id="app">
          <div class="grid">
            <div
              v-for="(post, index) in posts"
              class="grid-item"
              :class="{ active: index == activeIndex }"
              @click="activeIndex = index"
            >
              <template v-if="mediaPaths != null && mediaPaths[index][0]">
                <img
                  v-if="mediaPaths[index][0].endsWith('.jpg') || mediaPaths[index][0].endsWith('.webp')"
                  :src="mediaPaths[index][0]"
                  class="grid-media"
                />
                <video v-else :src="mediaPaths[index][0]" class="grid-media" autoplay muted />
              </template>
              <div v-else class="grid-placeholder">{{ index + 1 }}</div>
            </div>
          </div>

          <div class="info">
            <template v-if="mediaPaths != null">
              <div class="swiper">
                <div class="swiper-wrapper">
                  <div class="swiper-slide" v-for="mediaPath in mediaPaths[activeIndex]">
                    <img v-if="mediaPath.endsWith('.jpg') || mediaPath.endsWith('.webp')" :src="mediaPath" />
                    <video v-else :src="mediaPath" autoplay muted />
                  </div>
                </div>
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
              </div>
            </template>

            <div class="markdown-body" v-html="tableHTML"></div>
          </div>
        </div>

        <script type="module">
          import Swiper, { Navigation, Pagination } from "https://esm.sh/swiper@8"
          import { createApp } from "https://esm.sh/vue@3/dist/vue.esm-browser.js"

          function createTable(trs) {
            return "<table>" + trs.join("") + "</table>"
          }

          function createTr(...args) {
            const [key, value] = args.flat()
            return "<tr><td>" + key + "</td><td>" + value + "</td></tr>"
          }

          function createTableFromObject(object) {
            return createTable(
              Object.entries(object).map(([key, value]) =>
                createTr(
                  key,
                  Array.isArray(value)
                    ? value.map(element => createTableFromObject(element)).join("")
                    : typeof value == "object"
                    ? createTableFromObject(value)
                    : value
                )
              )
            )
          }

          createApp({
            data() {
              return {
                posts: ${JSON.stringify(posts)},
                mediaPaths: ${JSON.stringify(mediaPaths)},
                activeIndex: 0,
              }
            },
            computed: {
              tableHTML() {
                return createTableFromObject(this.posts[this.activeIndex])
              },
            },
            methods: {
              initSwiper() {
                this.swiper = new Swiper(".swiper", {
                  modules: [Navigation, Pagination],
                  navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
                  pagination: { el: ".swiper-pagination" },
                })
              },
            },
            mounted() {
              if (this.mediaPaths == null) return
              this.initSwiper()
            },
            updated() {
              if (this.mediaPaths == null) return
              this.swiper.destroy()
              this.initSwiper()
            },
          }).mount("#app")
        </script>
      </body>
    </html>
  `
}
