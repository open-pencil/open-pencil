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

const TEST_FILE = /^(tests|packages\/[^/]+\/tests)\//

const output = await $`bunx tsgo --noEmit -p tsconfig.tests.json`.nothrow().text()
const failures = output
  .split('\n')
  .filter((line) => line.includes('error TS') && TEST_FILE.test(line))

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(
    `\nFound ${failures.length} type ${failures.length === 1 ? 'error' : 'errors'} in tests.`
  )
  process.exit(1)
}
console.log('Test type check passed.')
