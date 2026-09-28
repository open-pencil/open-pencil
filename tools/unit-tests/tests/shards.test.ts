import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import {
  isHeavyUnitTest,
  listHeavyUnitTests,
  listUnitTests,
  pathsForUnitTestGroup,
  unitTestGroupNames
} from '../src/shards'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

async function discover(pattern: string): Promise<string[]> {
  return Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: REPO_ROOT }))
}

test('every app, engine and package-local test belongs to exactly one shard', async () => {
  const discovered = [
    ...(await discover('tests/app/**/*.test.ts')),
    ...(await discover('tests/integration/**/*.test.ts')),
    ...(await discover('tests/engine/**/*.test.ts')),
    ...(await discover('packages/*/tests/**/*.test.ts'))
  ].filter((file) => !file.startsWith('packages/harness/'))
  const paths = pathsForUnitTestGroup('all')
  const invalidAssignments = discovered.flatMap((file) => {
    const owners = paths.filter((path) => file.startsWith(`${path}/`))
    return owners.length === 1 ? [] : [{ file, owners }]
  })

  expect(discovered.length).toBeGreaterThan(0)
  expect(invalidAssignments).toEqual([])
  expect((await listUnitTests('all', { includeHeavy: true })).sort()).toEqual(discovered.sort())
})

test('canonical destinations are registered before they hold files', async () => {
  const paths = pathsForUnitTestGroup('all')
  expect(paths).toContain('tests/app')
  expect(paths).toContain('tests/integration')
  for (const owner of [
    'core',
    'scene-graph',
    'vue',
    'fig',
    'kiwi',
    'dom-css',
    'pen',
    'cli',
    'mcp'
  ]) {
    expect(paths).toContain(`packages/${owner}/tests`)
  }
  await expect(listUnitTests('all')).resolves.toBeArray()
})

test('quick and explicit heavy tests partition the full engine suite', async () => {
  const quick = await listUnitTests('all')
  const heavy = await listHeavyUnitTests()
  const all = await listUnitTests('all', { includeHeavy: true })

  expect(quick.filter((file) => heavy.includes(file))).toEqual([])
  expect([...quick, ...heavy].sort()).toEqual(all)
})

test('unit test groups cover all declared shards', () => {
  expect(unitTestGroupNames()).toContain('all')
  expect(pathsForUnitTestGroup('dom')).toContain('tests/engine/dom-css')
  expect(pathsForUnitTestGroup('fig')).toContain('packages/fig/tests')
  expect(pathsForUnitTestGroup('all')).toContain('tests/engine/io')
})

test('heavy unit test matcher excludes fixture-heavy tests', () => {
  expect(isHeavyUnitTest('tests/engine/io/fig/heavy/fixtures.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/io/fig/roundtrip/glyph-blob.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/dom-css/runtime.test.ts')).toBe(false)
})

test('quick unit test listing excludes heavy tests', async () => {
  const quickFiles = await listUnitTests('all')
  expect(quickFiles).toContain('tests/engine/dom-css/runtime.test.ts')
  expect(quickFiles).not.toContain('tests/engine/io/fig/heavy/fixtures.test.ts')
  expect(quickFiles).not.toContain('tests/engine/io/fig/roundtrip/glyph-blob.test.ts')
})

test('heavy unit test listing contains only heavy tests', async () => {
  const heavyFiles = await listHeavyUnitTests()
  expect(heavyFiles).toContain('tests/engine/io/fig/heavy/fixtures.test.ts')
  expect(heavyFiles.every(isHeavyUnitTest)).toBe(true)
})
