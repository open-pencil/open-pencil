import { expect, setDefaultTimeout, test } from 'bun:test'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FONT_FIXTURES } from '#cli-tests/helpers/fonts'
import { requireBuiltWorkspacePackages } from '#cli-tests/helpers/paths'
import { runCLI } from '#cli-tests/helpers/run'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { DocumentFontStatus } from '@open-pencil/core/text'
import { heavy } from '@open-pencil/test-support/heavy'
import { repoPath } from '@open-pencil/test-support/paths'
import { firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'
requireBuiltWorkspacePackages()
setDefaultTimeout(30_000)

const GOLD = repoPath('tests/fixtures/gold-preview.fig')
const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createFontFixture(fontFamily: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-fonts-cli-'))
  const path = join(directory, 'fonts.fig')
  const graph = makeSceneGraph('Fonts')
  graph.createNode('TEXT', firstPageId(graph), { text: 'Hello', fontFamily, fontWeight: 400 })
  const result = await io.writeDocument('fig', graph)
  await Bun.write(path, result.data as Uint8Array)
  return path
}

test('reports bundled fonts as available', async () => {
  const { stdout, stderr, exitCode } = await runCLI(['fonts', GOLD, '--json'])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  const data: DocumentFontStatus = JSON.parse(stdout)
  expect(data.faithful).toBe(true)
  expect(data.faces.every((face) => face.source === 'bundled')).toBe(true)
})

test('reports fonts installed in the folders OPENPENCIL_FONT_DIRS names', async () => {
  const fixture = await createFontFixture('Noto Sans CJK SC')
  const fonts = await mkdtemp(join(tmpdir(), 'open-pencil-installed-fonts-'))
  await copyFile(FONT_FIXTURES.cjk, join(fonts, 'NotoSansCJK-Test.otf'))
  const { stdout, stderr, exitCode } = await runCLI(['fonts', fixture, '--json'], {
    env: { OPENPENCIL_FONT_DIRS: fonts }
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  const data: DocumentFontStatus = JSON.parse(stdout)
  expect(data.faithful).toBe(true)
  expect(data.faces.map(({ family, source }) => ({ family, source }))).toEqual([
    { family: 'Noto Sans CJK SC', source: 'local' }
  ])
})

heavy('fonts CLI', () => {
  test('reports unavailable fonts without network access', async () => {
    const fixture = await createFontFixture('Definitely Missing Font')
    const { stdout, stderr, exitCode } = await runCLI(['fonts', fixture, '--json'])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    const data: DocumentFontStatus = JSON.parse(stdout)
    expect(data.faithful).toBe(false)
    expect(data.issues.length).toBeGreaterThan(0)
    expect(data.issues.every((face) => face.status === 'unresolved')).toBe(true)
  })
  test('uses the standard human-readable formatter', async () => {
    const { stdout, stderr, exitCode } = await runCLI(['fonts', GOLD])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('font faces')
    expect(stdout).toContain('Faithful: yes')
    expect(stdout).toContain('[Inter]')
  })
})
