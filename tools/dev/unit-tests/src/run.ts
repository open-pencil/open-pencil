#!/usr/bin/env bun

import { listHeavyUnitTests, listUnitTests, type UnitTestGroup, unitTestGroupNames } from './shards'

/**
 * Runs `bun test` over one shard group: quick files in one process, heavy files one per process.
 *
 *   bun tools/dev/unit-tests/src/run.ts [group] [--include-heavy | --heavy-only] [-- <bun test args>]
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
const lightFiles = heavyOnly ? [] : await listUnitTests(group)
const heavyFiles = includeHeavy ? await listHeavyUnitTests(group) : []

if (lightFiles.length === 0 && heavyFiles.length === 0) {
  console.log(`No unit tests found for shard ${group}`)
  process.exit(0)
}

async function runBunTest(files: string[]): Promise<number> {
  const child = Bun.spawn([process.execPath, 'test', ...bunTestArgs, ...files], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, BUN_HEAVY_TESTS: includeHeavy ? 'true' : 'false' }
  })
  return child.exited
}

// Light files share one process. Each heavy file gets its own, because one alone can take
// several gigabytes and a shared process would keep what earlier files left behind. Coverage
// is collected per process, so a coverage run keeps every file in one.
const coverage = bunTestArgs.some((arg) => arg.startsWith('--coverage'))
const batches = coverage
  ? [[...lightFiles, ...heavyFiles]]
  : [...(lightFiles.length > 0 ? [lightFiles] : []), ...heavyFiles.map((file) => [file])]
const failed: string[] = []
for (const files of batches) {
  if ((await runBunTest(files)) !== 0) failed.push(files.length === 1 ? files[0] : 'quick tests')
}
if (failed.length > 0) console.error(`\nFailed: ${failed.join(', ')}`)
process.exit(failed.length > 0 ? 1 : 0)
