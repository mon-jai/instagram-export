import { readFile } from "fs/promises"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

import { Post } from "./types"

export default async function generateViewHTML(params: {
  archiveName: string
  posts: Post[]
  mediaPaths: { [K: string]: string[] }
}) {
  let html = await readFile(
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "view.html"),
    "utf-8"
  )

  for (const [key, value] of Object.entries(params)) {
    html = html.replaceAll(new RegExp(`{ ${key} }`, "g"), typeof value == "string" ? value : JSON.stringify(value))
  }

  return html
}
