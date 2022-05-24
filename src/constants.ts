import { createRequire } from "module"
import { join } from "path"

export const { name: COMMAND_NAME, version: COMMAND_VERSION } = createRequire(import.meta.url)("../package.json") as {
  name: string
  version: string
}

export const KEYTAR_SERVICE_NAME = COMMAND_NAME

export const DATA_FILE_PATH = join(process.cwd(), "data.json")
