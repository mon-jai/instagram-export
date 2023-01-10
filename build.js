import { exec as execCallback } from "child_process"
import { readdir, rm } from "fs/promises"
import { relative, resolve } from "path"

import analyzeTsConfigExport from "ts-unused-exports"

const { default: analyzeTsConfig } = analyzeTsConfigExport

async function exec(command) {
  return new Promise((resolve, reject) =>
    execCallback(command, (error, stdout, stderr) => {
      const log = stdout + stderr

      if (error) reject(log)
      else resolve(log)
    })
  )
}

const binPath = "./node_modules/.bin/"
const outputPath = resolve("bin")

const unusedExports = analyzeTsConfig("./tsconfig.json", ["--ignoreFiles=bin"])
const noOfModulesWithUnusedExports = Object.keys(unusedExports).length

if (noOfModulesWithUnusedExports > 0) {
  console.log(
    Object.fromEntries(
      Object.entries(unusedExports).map(([filePath, exportNameAndLocations]) => [
        relative(resolve(), filePath),
        exportNameAndLocations.map(({ exportName }) => exportName),
      ])
    )
  )
  throw `${noOfModulesWithUnusedExports} module${
    noOfModulesWithUnusedExports > 1 ? "s" : ""
  } with unused exports found.`
}

await rm(outputPath, { recursive: true, force: true })
const prettierOutput = await exec(`${resolve(binPath, "prettier")} --write .`)
await exec(`${resolve(binPath, "tsc")} --declaration`)

console.log({
  "Formatted files": prettierOutput
    .trim()
    .split("\n")
    .map(lines => lines.split(" ")[0]),
  "Output files": (await readdir(outputPath)).map(file => relative(resolve(), resolve(outputPath, file))),
})
