#!/usr/bin/env node
import { Command } from "commander"

import collectionCommand from "./collection-command.js"
import { COMMAND_NAME, COMMAND_VERSION } from "./constants.js"

const program = new Command()

program.name(COMMAND_NAME)
program.description("Export Instagram profiles and collections in a version-controllable way")
program.version(COMMAND_VERSION)

program.addCommand(collectionCommand)
// instagram-export profile posts
// instagram-export profile highlights

program.parse()
