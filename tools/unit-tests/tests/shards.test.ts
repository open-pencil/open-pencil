import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import {
  isHeavyUnitTest,
  listHeavyUnitTests,
  listUnitTests,
  pathsForUnitTestGroup,
  unitTestGroupNames
} from '../src/shards'

test('every engine test belongs to exactly one shard', async () => {
  const discovered = await Array.fromAsync(
    new Bun.Glob('tests/engine/**/*.test.ts').scan({
      cwd: fileURLToPath(new URL('../../..', import.meta.url))
    })
  )
  const paths = pathsForUnitTestGroup('all')
  const invalidAssignments = discovered.flatMap((file) => {
    const owners = paths.filter((path) => file.startsWith(`${path}/`))
    return owners.length === 1 ? [] : [{ file, owners }]
  })

  expect(discovered.length).toBeGreaterThan(0)
  expect(invalidAssignments).toEqual([])
  expect((await listUnitTests('all', { includeHeavy: true })).sort()).toEqual(discovered.sort())
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
