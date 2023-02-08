import { Post } from "./types"
import html from "string-dedent"

export default function generatePostsHTML(
  archiveName: string,
  posts: Post[],
  mediaPaths: (string | undefined)[][] | null
) {
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
