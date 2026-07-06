#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import analyze from './commands/analyze'
import convert from './commands/convert'
import documents from './commands/documents'
import evalCmd from './commands/eval'
import exportCmd from './commands/export'
import find from './commands/find'
import formats from './commands/formats'
import importCmd from './commands/import'
import info from './commands/info'
import lint from './commands/lint'
import node from './commands/node'
import pages from './commands/pages'
import query from './commands/query'
import selection from './commands/selection'
import tree from './commands/tree'
import variables from './commands/variables'

const { version } = await import('../package.json')

const main = defineCommand({
  meta: {
    name: 'openpencil',
    description: 'OpenPencil CLI — inspect, export, and lint OpenPencil design documents',
    version
  },
  subCommands: {
    analyze,
    convert,
    documents,
    eval: evalCmd,
    export: exportCmd,
    import: importCmd,
    find,
    formats,
    info,
    lint,
    query,
    node,
    pages,
    selection,
    tree,
    variables
  }
})

void runMain(main)
