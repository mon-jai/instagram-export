#!/usr/bin/env node
import { Command } from "commander"

import collectionCommand from "./collection-command.js"
import { COMMAND_NAME } from "./constants.js"
import postCommand from "./post-command.js"

const program = new Command()

program.name(COMMAND_NAME)
program.addCommand(collectionCommand)
program.addCommand(postCommand)
// instagram-dl post
// instagram-dl user
// instagram-dl [url]

program.parse()
