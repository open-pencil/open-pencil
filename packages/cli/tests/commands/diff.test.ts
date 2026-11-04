import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { runCLI } from '#cli-tests/helpers/run'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as v from 'valibot'

import { FIXTURES } from '@open-pencil/test-support/paths'
setDefaultTimeout(60_000)

const FIXTURE = join(FIXTURES, 'gold-preview.fig')
const LOGO = '1:3494'
const TITLE = '1:3474'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
describe('diff CLI', () => {
  test('show, apply, and files round-trip an attribute patch headlessly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const patchPath = join(dir, 'logo.diff')
    const outPath = join(dir, 'out.fig')

    const shown = await runCLI([
      'diff',
      'show',
      LOGO,
      FIXTURE,
      '--attributes',
      'name="Brand" opacity={0.5}'
    ])
    expect(shown.exitCode).toBe(0)
    expect(shown.stdout).toBe(`@@ /Logo #${LOGO}\n-name="Logo"\n+name="Brand"\n+opacity={0.5}`)
    await writeFile(patchPath, shown.stdout)

    const applied = await runCLI(['diff', 'apply', patchPath, FIXTURE, '--output', outPath, '--json'])
    expect(applied.exitCode).toBe(0)
    expect(JSON.parse(applied.stdout)).toMatchObject({ applied: 1, failed: 0 })

    // Matched by path, the renamed logo reads as removed and added.
    const files = await runCLI(['diff', 'files', FIXTURE, outPath, '--json'])
    // Like diff(1), a difference exits 1.
    expect(files.exitCode).toBe(1)
    const result = v.parse(
      v.pipe(v.string(), v.parseJson(), v.object({ diff: v.string() })),
      files.stdout
    )
    expect(result.diff).toContain(`/Logo #${LOGO} removed`)
    expect(result.diff).toContain('opacity={0.5}')

    const stalePath = join(dir, 'stale.diff')
    await writeFile(stalePath, shown.stdout.replace('-name="Logo"', '-name="Other"'))
    const stale = await runCLI(['diff', 'apply', stalePath, FIXTURE, '--dry-run', '--json'])
    expect(stale.exitCode).toBe(1)
    expect(stale.stdout).toContain('name: expected name=\\"Other\\", found name=\\"Logo\\"')
  })

  test.each([
    [['--page', 'Nope'], 'Neither document has a page named "Nope"'],
    [['--depth', 'abc'], '--depth must be a non-negative integer, got "abc"'],
    [['--depth=-1'], '--depth must be a non-negative integer, got "-1"']
  ])('files rejects %p instead of reporting a match', async (options, error) => {
    const result = await runCLI(['diff', 'files', FIXTURE, FIXTURE, ...options])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain(error)
  })

  test('visual writes a PNG and reports the changed area', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const output = join(dir, 'diff.png')

    const result = await runCLI([
      'diff',
      'visual',
      FIXTURE,
      '--from',
      TITLE,
      '--to',
      TITLE,
      '--output',
      output,
      '--max-edge',
      '256',
      '--json'
    ])
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ changedPixels: 0, changedBounds: null })
    expect([...(await readFile(output)).subarray(0, 4)]).toEqual(PNG_SIGNATURE)
  })
})
