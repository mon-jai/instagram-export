import { Command } from "commander"

import { getPost } from "./request.js"

// Constants

const postCommand = new Command("post")

postCommand.argument("[url]").action(async (url: string) => {
  console.log(url)
  console.log(await getPost(url))
})

export default postCommand
