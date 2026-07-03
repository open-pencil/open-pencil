import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'

import {
  isHeavyUnitTest,
  listHeavyUnitTests,
  listUnitTests,
  pathsForUnitTestGroup,
  unitTestGroupNames
} from '../src/shards'

test('unit test groups cover all declared shards', () => {
  expect(unitTestGroupNames()).toContain('all')
  expect(pathsForUnitTestGroup('dom')).toContain('tests/engine/dom-css')
  expect(pathsForUnitTestGroup('app')).toContain('tests/engine/collab')
  expect(pathsForUnitTestGroup('fig')).toContain('tests/engine/fig')
  expect(pathsForUnitTestGroup('all')).toContain('tests/engine/io')
})

test('unit test groups cover every top-level engine test directory', async () => {
  const entries = await readdir(new URL('../../../tests/engine', import.meta.url), {
    withFileTypes: true
  })
  const engineDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `tests/engine/${entry.name}`)
    .sort()

  expect(pathsForUnitTestGroup('all').toSorted()).toEqual(engineDirectories)
})

test('heavy unit test matcher excludes fixture-heavy tests', () => {
  expect(isHeavyUnitTest('tests/engine/cli/eval.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/cli/overlaps.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/io/fig/heavy/fixtures.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/io/fig/roundtrip/glyph-blob.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/tools/cli.test.ts')).toBe(true)
  expect(isHeavyUnitTest('tests/engine/dom-css/runtime.test.ts')).toBe(false)
})

test('quick unit test listing excludes heavy tests', async () => {
  const quickFiles = await listUnitTests('all')
  expect(quickFiles).toContain('tests/engine/collab/yjs-sync.test.ts')
  expect(quickFiles).toContain('tests/engine/dom-css/runtime.test.ts')
  expect(quickFiles).not.toContain('tests/engine/cli/eval.test.ts')
  expect(quickFiles).not.toContain('tests/engine/cli/overlaps.test.ts')
  expect(quickFiles).not.toContain('tests/engine/io/fig/heavy/fixtures.test.ts')
  expect(quickFiles).not.toContain('tests/engine/io/fig/roundtrip/glyph-blob.test.ts')
  expect(quickFiles).not.toContain('tests/engine/tools/cli.test.ts')
})

test('heavy unit test listing contains only heavy tests', async () => {
  const heavyFiles = await listHeavyUnitTests()
  expect(heavyFiles).toContain('tests/engine/cli/eval.test.ts')
  expect(heavyFiles).toContain('tests/engine/cli/overlaps.test.ts')
  expect(heavyFiles).toContain('tests/engine/io/fig/heavy/fixtures.test.ts')
  expect(heavyFiles).toContain('tests/engine/tools/cli.test.ts')
  expect(heavyFiles.every(isHeavyUnitTest)).toBe(true)
})
