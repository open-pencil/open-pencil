#!/usr/bin/env bun

import { listHeavyUnitTests, listUnitTests, type UnitTestGroup, unitTestGroupNames } from './shards'

/**
 * Runs `bun test` over one shard group.
 *
 *   bun tools/unit-tests/src/run.ts [group] [--include-heavy | --heavy-only] [-- <bun test args>]
 *
 * Quick runs (the default) skip heavy fixture files and heavy-marked blocks;
 * `--include-heavy` runs everything and `--heavy-only` runs only the heavy
 * fixture files. Arguments after `--` go to `bun test` unchanged.
 */
const separator = process.argv.indexOf('--')
const ownArgs = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator)
const bunTestArgs = separator === -1 ? [] : process.argv.slice(separator + 1)
const flags = new Set(ownArgs.filter((arg) => arg.startsWith('--')))
const group = (ownArgs.find((arg) => !arg.startsWith('--')) ?? 'all') as UnitTestGroup

if (!unitTestGroupNames().includes(group)) {
  throw new Error(
    `Unknown unit test group: ${group}. Expected one of: ${unitTestGroupNames().join(', ')}`
  )
}

const heavyOnly = flags.has('--heavy-only')
const includeHeavy = heavyOnly || flags.has('--include-heavy')
const files = heavyOnly
  ? await listHeavyUnitTests(group)
  : await listUnitTests(group, { includeHeavy })

if (files.length === 0) {
  console.log(`No unit tests found for shard ${group}`)
  process.exit(0)
}

const child = Bun.spawn([process.execPath, 'test', ...bunTestArgs, ...files], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: { ...process.env, BUN_HEAVY_TESTS: includeHeavy ? 'true' : 'false' }
})
process.exit(await child.exited)
