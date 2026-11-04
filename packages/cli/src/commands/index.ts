import analyze from './analyze'
import convert from './convert'
import diff from './diff'
import documents from './documents'
import evalCmd from './eval'
import exportCmd from './export'
import find from './find'
import fonts from './fonts'
import formats from './formats'
import { redo, undo } from './history'
import importCmd from './import'
import info from './info'
import libraries from './libraries'
import lint from './lint'
import node from './node'
import pages from './pages'
import query from './query'
import selection from './selection'
import settings from './settings'
import tokens from './tokens'
import tool from './tool'
import tree from './tree'
import variables from './variables'

/**
 * The top-level `openpencil` commands by name, as `--help` lists them. The docs site counts them
 * from here, so its numbers follow the CLI.
 */
export const COMMANDS = {
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
