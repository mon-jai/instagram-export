#!/usr/bin/env node
import { Command } from "commander"

import CollectionCommand from "./collection-command.js"
import { COMMAND_NAME } from "./constants.js"

const program = new Command()

program.name(COMMAND_NAME)
program.addCommand(new CollectionCommand("collection"))
// instagram-dl account

program.parse()
