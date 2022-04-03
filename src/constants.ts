import { createRequire } from "module"

export const { name: COMMAND_NAME, version: COMMAND_VERSION } = createRequire(import.meta.url)("../package.json") as {
  name: string
  version: string
}

export const KEYTAR_SERVICE_NAME = COMMAND_NAME
