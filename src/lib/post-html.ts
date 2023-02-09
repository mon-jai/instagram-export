import { Post } from "./types"
import html from "string-dedent"

export default function generatePostsHTML(archiveName: string, posts: Post[], mediaPaths: (string[] | null)[] | null) {
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
            background-color: rgb(250, 250, 250);
          }

          #app {
            height: 100vh;
            display: flex;
            justify-content: center;
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
            border-radius: 4px;

            position: relative;
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
            max-width: 1241px;
            padding: 52px;
            flex: 1;

            display: flex;
            flex-direction: column;
            gap: 52px;

            overflow: auto;
          }

          .swiper {
            width: 100%;
            height: 50%;
            background-color: rgb(239, 239, 239);

            /* Vertically center, https://stackoverflow.com/a/33455342 */
            margin-top: auto;

            flex-shrink: 0;
          }

          .swiper img,
          .swiper video {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .swiper-button-prev:after,
          .swiper-button-next:after {
            font-size: 1.5rem;
            color: #262626; /* Regular instagram icon's color in light theme */
          }

          .swiper-button-next {
            right: 20px;
          }

          .swiper-button-prev {
            left: 20px;
          }

          .swiper-button-disabled {
            visibility: hidden;
          }

          .swiper-pagination-bullet {
            background-color: white;
            opacity: 0.4;
          }

          .swiper-pagination-bullet-active {
            opacity: 1;
          }

          .markdown-body {
            /* Vertically center, https://stackoverflow.com/a/33455342 */
            margin-bottom: auto;
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
              <template v-if="mediaPaths?.[index] != null">
                <img
                  v-if="mediaPaths[index][0].endsWith('.jpg') || mediaPaths[index][0].endsWith('.webp')"
                  :src="mediaPaths[index][0]"
                  class="grid-media"
                  loading="lazy"
                />
                <video v-else :src="mediaPaths[index][0]" class="grid-media" autoplay muted />
              </template>
              <div v-else class="grid-placeholder">{{ posts.length - index }}</div>
            </div>
          </div>

          <div class="info">
            <div class="swiper" v-show="activePostHasMedia">
              <div class="swiper-wrapper">
                <div v-if="activePostHasMedia" v-for="mediaPath in mediaPaths[activeIndex]" class="swiper-slide">
                  <img v-if="mediaPath.endsWith('.jpg') || mediaPath.endsWith('.webp')" :src="mediaPath" />
                  <video v-else :src="mediaPath" controls />
                </div>
              </div>
            </div>

            <!-- Vertically center, https://stackoverflow.com/a/33455342 -->
            <div class="markdown-body" v-html="tableHTML" :style="!activePostHasMedia ? { marginTop: 'auto' } : {}" />
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
              activePostHasMedia() {
                return this.mediaPaths?.[this.activeIndex] != null
              },
            },
            mounted() {
              this.swiper = new Swiper(".swiper", {
                createElements: true,
                grabCursor: true,
                modules: [Navigation, Pagination],
                navigation: true,
                pagination: true,
              })
            },
            updated() {
              this.swiper.update()
              this.swiper.slideTo(0, 0)
            },
          }).mount("#app")
        </script>
      </body>
    </html>
  `
}
