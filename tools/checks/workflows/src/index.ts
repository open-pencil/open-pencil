#!/usr/bin/env bun
/**
 * Fails when a workflow or composite action runs more than one line of shell in a step. Logic
 * belongs in a tested script under `tools/` that the step calls in one line.
 *
 *   bun tools/checks/workflows/src/index.ts
 */
import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { multiLineRuns } from './steps'

const root = await resolveWorkspaceRoot(import.meta.dir)
const patterns = ['.github/workflows/*.{yml,yaml}', '.github/actions/**/action.{yml,yaml}']
const files = (
  await Promise.all(
    patterns.map((pattern) =>
      Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: root, absolute: true }))
    )
  )
).flat()

let failures = 0
for (const file of files.toSorted()) {
  for (const run of multiLineRuns(await readFile(file, 'utf8'))) {
    failures++
    console.error(
      `${relative(root, file)}:${run.line}: run holds ${run.lines} lines of shell; ` +
        'move them into a tested script under tools/ and call it in one line'
    )
  }
}
if (failures > 0) process.exit(1)
console.log(`${files.length} workflows and actions run one line of shell per step`)
