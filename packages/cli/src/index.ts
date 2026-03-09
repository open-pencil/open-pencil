#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import analyze from './commands/analyze'
import evalCmd from './commands/eval'
import exportCmd from './commands/export'
import find from './commands/find'
import info from './commands/info'
import node from './commands/node'
import pages from './commands/pages'
import tree from './commands/tree'
import variables from './commands/variables'

const { version } = await import('../package.json')

const main = defineCommand({
  meta: {
    name: 'open-pencil',
    description: 'OpenPencil CLI — inspect, export, and lint .fig design files',
    version
  },
  subCommands: {
    analyze,
    eval: evalCmd,
    export: exportCmd,
    find,
    info,
    node,
    pages,
    tree,
    variables
  }
})

void runMain(main)
