#!/usr/bin/env node
import CollectionCommand from "./collection-command.js"
import { Command } from "commander"

const program = new Command()

program.name("instagram-dl")
program.addCommand(new CollectionCommand('collection'))
// instagram-dl account

program.parse()
