import { createRequire } from "module"
import { join } from "path"

export const { name: COMMAND_NAME, version: COMMAND_VERSION } = createRequire(import.meta.url)("../package.json") as {
  name: string
  version: string
}

export const DATA_FILE_PATH = join(process.cwd(), "data.json")

export const MEDIA_FOLDER = join(process.cwd(), "media")
