import { expect, test } from 'bun:test'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import {
  isHeavyUnitTest,
  LARGE_FIXTURES,
  owningUnitTestPath,
  listHeavyUnitTests,
  listUnitTests,
  pathsForUnitTestGroup,
  unitTestGroupNames
} from '../src/shards'

const REPO_ROOT = await resolveWorkspaceRoot(import.meta.dir)
// Packages whose tests run in their own CI job instead of the unit shards.
const OWN_SUITES = [
  'packages/harness/',
  'packages/feedback/',
  'packages/cloud/',
  'packages/oxlint-plugin/'
]

async function discover(pattern: string): Promise<string[]> {
  return Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: REPO_ROOT }))
}

test('every central and package-local test belongs to exactly one shard', async () => {
  // All of `tests/`, not only the canonical homes, so a test placed anywhere else fails here.
  const discovered = [
    ...(await discover('tests/**/*.test.{ts,tsx}')),
    ...(await discover('packages/*/tests/**/*.test.{ts,tsx}'))
  ].filter((file) => !OWN_SUITES.some((suite) => file.startsWith(suite)))
  const paths = pathsForUnitTestGroup('all')
  // The longest containing path owns a file; two owners of that same length would both run it.
  const invalidAssignments = discovered.flatMap((file) => {
    const owner = owningUnitTestPath(file)
    const ties = paths.filter(
      (path) => path.length === owner?.length && file.startsWith(`${path}/`)
    )
    return owner && ties.length === 1 ? [] : [{ file, owners: ties }]
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
    'design-jsx',
    'emit',
    'drawio',
    'mermaid',
    'html-engine',
    'pen',
    'cli',
    'mcp'
  ]) {
    expect(paths).toContain(`packages/${owner}/tests`)
  }
  await expect(listUnitTests('all')).resolves.toBeArray()
})

test('quick and explicit heavy tests partition the full unit suite', async () => {
  const quick = await listUnitTests('all')
  const heavy = await listHeavyUnitTests()
  const all = await listUnitTests('all', { includeHeavy: true })

  expect(quick.filter((file) => heavy.includes(file))).toEqual([])
  expect([...quick, ...heavy].sort()).toEqual(all)
})

test('unit test groups cover all declared shards', () => {
  expect(unitTestGroupNames()).toContain('all')
  expect(pathsForUnitTestGroup('dom')).toContain('packages/dom-css/tests')
  expect(pathsForUnitTestGroup('fig')).toContain('packages/fig/tests')
  expect(pathsForUnitTestGroup('all')).toContain('tests/app')
})

test('heavy unit test matcher excludes fixture-heavy tests', () => {
  expect(isHeavyUnitTest('packages/core/tests/io/formats/fig/heavy/fixtures.test.ts')).toBe(true)
  expect(isHeavyUnitTest('packages/core/tests/io/formats/fig/roundtrip/glyph-blob.test.ts')).toBe(
    true
  )
  expect(isHeavyUnitTest('packages/dom-css/tests/runtime.test.ts')).toBe(false)
})

test('quick unit test listing excludes heavy tests', async () => {
  const quickFiles = await listUnitTests('all')
  expect(quickFiles).toContain('packages/dom-css/tests/runtime.test.ts')
  expect(quickFiles).not.toContain('packages/core/tests/io/formats/fig/heavy/fixtures.test.ts')
})

test('heavy unit test listing contains only heavy tests', async () => {
  const heavyFiles = await listHeavyUnitTests()
  expect(heavyFiles).toContain('packages/core/tests/io/formats/fig/heavy/fixtures.test.ts')
  expect(heavyFiles.every(isHeavyUnitTest)).toBe(true)
})

test('every test that reads a large fixture is heavy', async () => {
  const quick = await listUnitTests('all')
  const readers = await Promise.all(
    quick.map(async (file) => {
      const source = await Bun.file(`${REPO_ROOT}/${file}`).text()
      return LARGE_FIXTURES.some((fixture) => source.includes(fixture)) ? [file] : []
    })
  )
  // One of these can take several gigabytes; add it to HEAVY_UNIT_TEST_PATTERNS.
  expect(readers.flat()).toEqual([])
})

test('a more specific path takes its files out of the broader group', async () => {
  const core = await listUnitTests('core', { includeHeavy: true })
  const render = await listUnitTests('render', { includeHeavy: true })
  expect(render.length).toBeGreaterThan(0)
  expect(render.every((file) => file.startsWith('packages/core/tests/canvas/'))).toBe(true)
  expect(core.some((file) => file.startsWith('packages/core/tests/canvas/'))).toBe(false)
})
