import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { UNIT_TEST_GROUPS } from '@open-pencil/unit-tests-tools/shards'

export const ENGINE_TESTS_ROOT = 'tests/engine'
export const ENGINE_BASELINE_PATH = 'tools/checks/test-homes/engine-baseline.txt'

export interface TestHomesOptions {
  repoRoot: string
  baselinePath?: string
  /** Defaults to the discovered `tests/engine` files; tests inject a listing. */
  engineTests?: readonly string[]
}

export interface TestHomesResult {
  errors: string[]
  /** `tests/engine` files that the baseline still allows. */
  remaining: number
}

/** Canonical home for a `tests/engine/<dir>/...` file, from the shard map. */
export function canonicalHomeFor(engineTestPath: string): string | undefined {
  for (const paths of Object.values(UNIT_TEST_GROUPS)) {
    const engineDirs: readonly string[] = paths.filter((path) =>
      path.startsWith(`${ENGINE_TESTS_ROOT}/`)
    )
    if (!engineDirs.some((dir) => engineTestPath.startsWith(`${dir}/`))) continue
    return paths.find((path) => !path.startsWith(`${ENGINE_TESTS_ROOT}/`))
  }
  return undefined
}

export function parseBaseline(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

export function formatBaseline(files: readonly string[]): string {
  const header = [
    '# Unit tests still under tests/engine, the migration debt from',
    "# packages/docs/development/testing.md. New tests go to the owner's canonical",
    '# home; remove a line here when its file moves. Regenerate with',
    '# `bun tools/checks/test-homes/src/index.ts --write`.'
  ]
  return [...header, ...[...files].sort()].join('\n') + '\n'
}

/** Every test file under `tests/engine`, discovered or not, so an unsharded file cannot hide. */
export async function listEngineTests(repoRoot: string): Promise<string[]> {
  const files = await Array.fromAsync(
    new Bun.Glob(`${ENGINE_TESTS_ROOT}/**/*.test.ts`).scan({ cwd: repoRoot })
  )
  return files.map((file) => file.split('\\').join('/')).sort()
}

/**
 * Every `tests/engine` test file must be in the reviewed baseline, and every baseline entry must
 * still exist, so the debt only shrinks: a new test goes to its owner's canonical home from day one.
 */
export async function checkTestHomes(options: TestHomesOptions): Promise<TestHomesResult> {
  const baselinePath = resolve(options.repoRoot, options.baselinePath ?? ENGINE_BASELINE_PATH)
  if (!existsSync(baselinePath)) {
    return { errors: [`Missing engine test baseline at ${baselinePath}`], remaining: 0 }
  }
  const baseline = new Set(parseBaseline(readFileSync(baselinePath, 'utf8')))
  const engineTests = options.engineTests ?? (await listEngineTests(options.repoRoot))
  const present = new Set(engineTests)
  const errors: string[] = []

  for (const file of engineTests) {
    if (baseline.has(file)) continue
    const home = canonicalHomeFor(file)
    errors.push(
      `${file} is a new test under ${ENGINE_TESTS_ROOT}; put it under ${home ?? "the owner's canonical home"} instead`
    )
  }
  for (const file of baseline) {
    if (!present.has(file)) errors.push(`${file} no longer exists; remove it from the baseline`)
  }

  return { errors, remaining: [...baseline].filter((file) => present.has(file)).length }
}
