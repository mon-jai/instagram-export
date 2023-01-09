import { exec as execCallback } from "child_process"
import { readdir, rm } from "fs/promises"
import { relative, resolve } from "path"

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
