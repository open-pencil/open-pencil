#!/usr/bin/env bun
/**
 * Fails when a unit test is added under `tests/engine` instead of its owner's canonical home,
 * or when the baseline lists a file that has moved.
 *
 *   bun tools/checks/test-homes/src/index.ts          # check
 *   bun tools/checks/test-homes/src/index.ts --write  # rewrite the baseline from the current tree
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { ENGINE_BASELINE_PATH, checkTestHomes, formatBaseline, listEngineTests } from './homes'

const repoRoot = await resolveWorkspaceRoot(process.cwd())

if (process.argv.includes('--write')) {
  const files = await listEngineTests(repoRoot)
  await writeFile(resolve(repoRoot, ENGINE_BASELINE_PATH), formatBaseline(files))
  console.log(`Wrote ${files.length} tests/engine files to ${ENGINE_BASELINE_PATH}.`)
  process.exit(0)
}

const result = await checkTestHomes({ repoRoot })
if (result.errors.length > 0) {
  console.error('Test placement check failed:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(
  `Test placement check passed; ${result.remaining} tests/engine files remain to migrate.`
)
