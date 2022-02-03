#!/usr/bin/env node
import { Command } from "commander"

import CollectionCommand from "./collection-command.js"

const program = new Command()

program.name("instagram-dl")
program.addCommand(new CollectionCommand("collection"))
// instagram-dl account

program.parse()
