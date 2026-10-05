#!/usr/bin/env bun
/**
 * Typechecks the test suites, which no other program covers: `tsconfig.json` includes only
 * `src/**`, each package config only its own `src`, and bun strips types without checking them.
 *
 * Application and package sources are reported only by `bun run typecheck`, never here. This
 * program narrows `types` to Bun's so `bun:test` resolves, and Bun's globals disagree with the
 * browser ones the app is built against — `fetch` carries a `preconnect` the DOM one does not.
 * Judging source by those globals would fail the build for a shape the app never ships.
 */
import { $ } from 'bun'

/** `path/to/file.ts(12,5): error TS1234: …` — a diagnostic about a file in the program. */
const FILE_DIAGNOSTIC = /^(?<file>\S[^(]*)\(\d+,\d+\): error TS/
const TEST_FILE = /^(tests|packages\/[^/]+\/tests)\//

const result = await $`bunx tsgo --noEmit -p tsconfig.tests.json`.nothrow().quiet()
const lines = `${result.stdout.toString()}${result.stderr.toString()}`.split('\n')

const failures: string[] = []
/** A diagnostic naming no file is the compiler or the config failing, not a typed program. */
const unscoped: string[] = []

for (const line of lines) {
  if (!line.includes('error TS')) continue
  const file = FILE_DIAGNOSTIC.exec(line)?.groups?.file
  if (file === undefined) unscoped.push(line)
  else if (TEST_FILE.test(file)) failures.push(line)
}

if (unscoped.length > 0) {
  console.error(unscoped.join('\n'))
  console.error('\nThe test type check could not run.')
  process.exit(1)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(
    `\nFound ${failures.length} type ${failures.length === 1 ? 'error' : 'errors'} in tests.`
  )
  process.exit(1)
}

if (
  result.exitCode !== 0 &&
  failures.length === 0 &&
  lines.every((line) => !line.includes('error TS'))
) {
  console.error(lines.join('\n').trim() || `tsgo exited with ${result.exitCode}`)
  console.error('\nThe test type check could not run.')
  process.exit(1)
}

console.log('Test type check passed.')
