#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import analyze from './commands/analyze'
import convert from './commands/convert'
import diff from './commands/diff'
import documents from './commands/documents'
import evalCmd from './commands/eval'
import exportCmd from './commands/export'
import find from './commands/find'
import fonts from './commands/fonts'
import formats from './commands/formats'
import { redo, undo } from './commands/history'
import importCmd from './commands/import'
import info from './commands/info'
import libraries from './commands/libraries'
import lint from './commands/lint'
import node from './commands/node'
import pages from './commands/pages'
import query from './commands/query'
import selection from './commands/selection'
import settings from './commands/settings'
import tokens from './commands/tokens'
import tool from './commands/tool'
import tree from './commands/tree'
import variables from './commands/variables'

const { version } = await import('../package.json')

const main = defineCommand({
  meta: {
    name: 'openpencil',
    description:
      'OpenPencil CLI — inspect, export, and lint design documents, and drive the running app',
    version
  },
  subCommands: {
    analyze,
    convert,
    diff,
    documents,
    eval: evalCmd,
    export: exportCmd,
    import: importCmd,
    find,
    formats,
    fonts,
    info,
    lint,
    libraries,
    query,
    node,
    pages,
    redo,
    selection,
    settings,
    tool,
    tokens,
    tree,
    undo,
    variables
  }
})

void runMain(main)
