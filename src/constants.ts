import { createRequire } from "module"

export const { name: COMMAND_NAME } = createRequire(import.meta.url)("../package.json") as { name: string }

export const KEYTAR_SERVICE_NAME = COMMAND_NAME
