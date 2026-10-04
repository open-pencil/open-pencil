import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CLI_ENTRY, FIXTURES } from '#cli-tests/helpers/paths'

setDefaultTimeout(60_000)

const FIXTURE = join(FIXTURES, 'gold-preview.fig')
const LOGO = '0:10'
const TITLE = '0:9'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('diff CLI', () => {
  test('show, apply, and files round-trip an attribute patch headlessly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const patchPath = join(dir, 'logo.diff')
    const outPath = join(dir, 'out.fig')

    const shown = await cli([
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

    const applied = await cli(['diff', 'apply', patchPath, FIXTURE, '--output', outPath, '--json'])
    expect(applied.exitCode).toBe(0)
    expect(JSON.parse(applied.stdout)).toMatchObject({ applied: 1, failed: 0 })

    // Matched by path, the renamed logo reads as removed and added.
    const files = await cli(['diff', 'files', FIXTURE, outPath, '--json'])
    // Like diff(1), a difference exits 1.
    expect(files.exitCode).toBe(1)
    const result = JSON.parse(files.stdout) as { diff: string }
    expect(result.diff).toContain(`/Logo #${LOGO} removed`)
    expect(result.diff).toContain('opacity={0.5}')

    const stalePath = join(dir, 'stale.diff')
    await writeFile(stalePath, shown.stdout.replace('-name="Logo"', '-name="Other"'))
    const stale = await cli(['diff', 'apply', stalePath, FIXTURE, '--dry-run', '--json'])
    expect(stale.exitCode).toBe(1)
    expect(stale.stdout).toContain('name: expected name=\\"Other\\", found name=\\"Logo\\"')
  })

  test.each([
    [['--page', 'Nope'], 'Neither document has a page named "Nope"'],
    [['--depth', 'abc'], '--depth must be a non-negative integer, got "abc"'],
    [['--depth=-1'], '--depth must be a non-negative integer, got "-1"']
  ])('files rejects %p instead of reporting a match', async (options, error) => {
    const result = await cli(['diff', 'files', FIXTURE, FIXTURE, ...options])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain(error)
  })

  test('visual writes a PNG and reports the changed area', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const output = join(dir, 'diff.png')

    const result = await cli([
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
