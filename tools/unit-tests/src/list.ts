#!/usr/bin/env bun

import { listHeavyUnitTests, listUnitTests, type UnitTestGroup, unitTestGroupNames } from './shards'

const args = new Set(process.argv.slice(2))
const groupArg = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'all'
const groupNames = unitTestGroupNames()

if (!groupNames.includes(groupArg as UnitTestGroup)) {
  throw new Error(`Unknown unit test group: ${groupArg}. Expected one of: ${groupNames.join(', ')}`)
}

const group = groupArg as UnitTestGroup
const files = args.has('--heavy-only')
  ? await listHeavyUnitTests(group)
  : await listUnitTests(group, { includeHeavy: args.has('--include-heavy') })

process.stdout.write(files.join('\n'))
if (files.length > 0) process.stdout.write('\n')
