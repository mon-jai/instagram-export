#!/usr/bin/env node
import { Command } from "commander"

import collectionCommand from "./collection-command.js"
import { COMMAND_NAME } from "./constants.js"

const program = new Command()

program.name(COMMAND_NAME)
program.addCommand(collectionCommand)
// instagram-export profile posts
// instagram-export profile highlights

program.parse()
