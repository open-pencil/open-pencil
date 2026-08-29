#!/usr/bin/env bun

import { defineCommand, runMain } from 'citty'

import { checkCommand, smokeCommand, verifyCommand } from './commands'

const main = defineCommand({
  meta: { name: 'package-quality', description: 'Validate OpenPencil public packages' },
  subCommands: {
    check: checkCommand,
    smoke: smokeCommand,
    verify: verifyCommand
  }
})

await runMain(main)
