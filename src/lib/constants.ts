import { resolve } from "path"

import { getChromeDefaultHeaders } from "./utils.js"

export const DATA_FILENAME = "data.yml"

export const DATA_FILE = resolve(DATA_FILENAME)

export const MEDIA_DIRECTORY_NAME = "media"

export const MEDIA_FOLDER = resolve(MEDIA_DIRECTORY_NAME)

export const REQUEST_HEADERS = getChromeDefaultHeaders()
