import { readFile } from "fs/promises"

import { VIEW_HTML_PATH, VIEW_HTML_SRC_PATH } from "./constants.js"
import { Post } from "./types.js"

export default async function generateViewHTML(params: {
  archiveName: string
  url: string
  posts: Post[]
  mediaPaths: { [K: string]: string[] }
  dev: boolean
}) {
  let html = await readFile(params.dev ? VIEW_HTML_SRC_PATH : VIEW_HTML_PATH, "utf-8")

  if (params.dev) params.archiveName = `${params.archiveName} (dev)`
  for (const [key, value] of Object.entries(params)) {
    html = html.replaceAll(new RegExp(`{ ${key} }`, "g"), typeof value == "string" ? value : JSON.stringify(value))
  }

  return html
}
