#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import { COMMANDS } from './commands'

const { version } = await import('../package.json')

const main = defineCommand({
  meta: {
    name: 'openpencil',
    description:
      'OpenPencil CLI — inspect, export, and lint design documents, and drive the running app',
    version
  },
  subCommands: COMMANDS
})

void runMain(main)
