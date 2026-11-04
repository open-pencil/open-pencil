#!/usr/bin/env bun

import { listHeavyUnitTests, listUnitTests, type UnitTestGroup, unitTestGroupNames } from './shards'

/**
 * Runs `bun test` over one shard group: quick files in one process, heavy files one per process.
 * `all` runs each group's quick files in a process of its own, as CI does.
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
// Groups set up globals of their own, such as the app tests' stand-in `window`, which Core reads
// once when it loads; a process shared across groups would carry them into the next group.
const groups = group === 'all' ? unitTestGroupNames().filter((name) => name !== 'all') : [group]
const lightGroups = heavyOnly
  ? []
  : (
      await Promise.all(groups.map(async (name) => ({ name, files: await listUnitTests(name) })))
    ).filter(({ files }) => files.length > 0)
const heavyFiles = includeHeavy ? await listHeavyUnitTests(group) : []

if (lightGroups.length === 0 && heavyFiles.length === 0) {
  console.log(`No unit tests found for shard ${group}`)
  process.exit(0)
}

async function runBunTest(files: string[], args: string[]): Promise<number> {
  const child = Bun.spawn([process.execPath, 'test', ...args, ...files], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, BUN_HEAVY_TESTS: includeHeavy ? 'true' : 'false' }
  })
  return child.exited
}

// A group's light files share one process. Each heavy file gets its own, because one alone can
// take several gigabytes and a shared process would keep what earlier files left behind.
// Coverage is collected per process, so a coverage run keeps every file in one.
const coverage = bunTestArgs.some((arg) => arg.startsWith('--coverage'))
const batches = coverage
  ? [{ label: 'tests', files: [...lightGroups.flatMap(({ files }) => files), ...heavyFiles] }]
  : [
      ...lightGroups.map(({ name, files }) => ({ label: `${name} quick tests`, files })),
      ...heavyFiles.map((file) => ({ label: file, files: [file] }))
    ]
// A name filter may match tests in only some of the batches; the others then have none to run.
const args = batches.length > 1 ? [...bunTestArgs, '--pass-with-no-tests'] : bunTestArgs
const failed: string[] = []
for (const { label, files } of batches) {
  if ((await runBunTest(files, args)) !== 0) failed.push(label)
}
if (failed.length > 0) console.error(`\nFailed: ${failed.join(', ')}`)
process.exit(failed.length > 0 ? 1 : 0)
