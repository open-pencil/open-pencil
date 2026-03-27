#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import analyze from './commands/analyze'
import convert from './commands/convert'
import evalCmd from './commands/eval'
import exportCmd from './commands/export'
import find from './commands/find'
import formats from './commands/formats'
import info from './commands/info'
import node from './commands/node'
import pages from './commands/pages'
import query from './commands/query'
import tree from './commands/tree'
import variables from './commands/variables'

const { version } = await import('../package.json')

const main = defineCommand({
  meta: {
    name: 'open-pencil',
    description: 'OpenPencil CLI — inspect, export, and lint OpenPencil design documents',
    version
  },
  subCommands: {
    analyze,
    convert,
    eval: evalCmd,
    export: exportCmd,
    find,
    formats,
    info,
    query,
    node,
    pages,
    tree,
    variables
  }
})

void runMain(main)
