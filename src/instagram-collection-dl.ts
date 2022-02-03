#!/usr/bin/env node
import CollectionCommand from "./collection-command.js"

const program = new CollectionCommand("instagram-collection-download")

program.parse()
