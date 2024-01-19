import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

import { getChromeDefaultHeaders } from "./utils.js"

const PACKAGE_ROOT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

export const DATA_FILENAME = "data.yml"

export const DATA_FILE = resolve(DATA_FILENAME)

export const MEDIA_DIRECTORY_NAME = "media"

export const MEDIA_FOLDER = resolve(MEDIA_DIRECTORY_NAME)

export const ASSETS_PATH = resolve(PACKAGE_ROOT_PATH, "assets")

export const VIEW_HTML_PATH = resolve(ASSETS_PATH, "index.html")

export const VIEW_HTML_SRC_PATH = resolve(PACKAGE_ROOT_PATH, "src", "view.html")

export const REQUEST_HEADERS = getChromeDefaultHeaders()
