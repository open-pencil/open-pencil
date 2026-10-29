#!/usr/bin/env bun
/**
 * Typechecks the programs no other check covers: the test suites (`tsconfig.tests.json`) and the
 * repository tools (`tools/tsconfig.json`). `tsconfig.json` includes only `src/**`, each package
 * config only its own `src`, and bun strips types without checking them.
 *
 * Application and package sources are reported only by `bun run typecheck`, never here. Both
 * programs reach them — tests drive the app, and tools read `window.openPencil` in pages — but
 * narrow `types` to Bun's, whose globals disagree with the browser ones the app is built against:
 * `fetch` carries a `preconnect` the DOM one does not. Judging source by those globals would fail
 * the build for a shape the app never ships.
 */
import { $ } from 'bun'

/** `path/to/file.ts(12,5): error TS1234: …` — a diagnostic about a file in the program. */
const FILE_DIAGNOSTIC = /^(?<file>\S[^(]*)\(\d+,\d+\): error TS/

const PROGRAMS = {
  tests: {
    project: 'tsconfig.tests.json',
    owns: /^(tests|packages\/[^/]+\/tests)\//,
    name: 'test'
  },
  tools: { project: 'tools/tsconfig.json', owns: /^tools\//, name: 'tool' }
}

const programName = process.argv.at(2) ?? 'tests'
if (!(programName in PROGRAMS)) {
  console.error(`Unknown program "${programName}"; expected ${Object.keys(PROGRAMS).join(' or ')}.`)
  process.exit(1)
}
const program = PROGRAMS[programName as keyof typeof PROGRAMS]

const result = await $`bunx tsc --noEmit -p ${program.project}`.nothrow().quiet()
const lines = `${result.stdout.toString()}${result.stderr.toString()}`.split('\n')

const failures: string[] = []
/** A diagnostic naming no file is the compiler or the config failing, not a typed program. */
const unscoped: string[] = []

for (const line of lines) {
  if (!line.includes('error TS')) continue
  const file = FILE_DIAGNOSTIC.exec(line)?.groups?.file
  if (file === undefined) unscoped.push(line)
  else if (program.owns.test(file)) failures.push(line)
}

if (unscoped.length > 0) {
  console.error(unscoped.join('\n'))
  console.error(`\nThe ${program.name} type check could not run.`)
  process.exit(1)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(
    `\nFound ${failures.length} type ${failures.length === 1 ? 'error' : 'errors'} in ${program.name}s.`
  )
  process.exit(1)
}

if (
  result.exitCode !== 0 &&
  failures.length === 0 &&
  lines.every((line) => !line.includes('error TS'))
) {
  console.error(lines.join('\n').trim() || `tsc exited with ${result.exitCode}`)
  console.error(`\nThe ${program.name} type check could not run.`)
  process.exit(1)
}

console.log(`${program.name.charAt(0).toUpperCase()}${program.name.slice(1)} type check passed.`)
