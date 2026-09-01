import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import type { DocumentFontStatus } from '@open-pencil/core/text'

import { runOpenPencilCLI } from '#tests/helpers/cli'
import { repoPath, requireBuiltWorkspacePackages } from '#tests/helpers/paths'
import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'
import { heavy } from '#tests/helpers/test-utils'

requireBuiltWorkspacePackages()
setDefaultTimeout(30_000)

const GOLD = repoPath('tests/fixtures/gold-preview.fig')
const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createUnresolvedFontFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-fonts-cli-'))
  const path = join(directory, 'unresolved.fig')
  const graph = makeSceneGraph('Fonts')
  graph.createNode('TEXT', firstPageId(graph), {
    text: 'Hello',
    fontFamily: 'Definitely Missing Font',
    fontWeight: 400
  })
  const result = await io.writeDocument('fig', graph)
  await Bun.write(path, result.data as Uint8Array)
  return path
}

test('reports bundled fonts as available', async () => {
  const { stdout, stderr, exitCode } = await runOpenPencilCLI(['fonts', GOLD, '--json'])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  const data: DocumentFontStatus = JSON.parse(stdout)
  expect(data.faithful).toBe(true)
  expect(data.faces.every((face) => face.source === 'bundled')).toBe(true)
})

heavy('fonts CLI', () => {
  test('reports unavailable fonts without network access', async () => {
    const fixture = await createUnresolvedFontFixture()
    const { stdout, stderr, exitCode } = await runOpenPencilCLI(['fonts', fixture, '--json'])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    const data: DocumentFontStatus = JSON.parse(stdout)
    expect(data.faithful).toBe(false)
    expect(data.issues.length).toBeGreaterThan(0)
    expect(data.issues.every((face) => face.status === 'unresolved')).toBe(true)
  })
  test('uses the standard human-readable formatter', async () => {
    const { stdout, stderr, exitCode } = await runOpenPencilCLI(['fonts', GOLD])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('font faces')
    expect(stdout).toContain('Faithful: yes')
    expect(stdout).toContain('[Inter]')
  })
})
