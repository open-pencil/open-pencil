import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'
import * as v from 'valibot'

import { FileSystemLibraryCatalog } from '@open-pencil/cli/library'

setDefaultTimeout(60_000)

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

const librarySchema = v.object({ latestRevisionId: v.string() })

describe('libraries CLI', () => {
  test('publishes components that have no asset key yet, saving the keys it gives only with --write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-cli-'))
    const authored = join(dir, 'library.pen')
    const source = join(dir, 'library.fig')
    const catalog = join(dir, 'catalog')
    await Bun.write(
      authored,
      JSON.stringify({
        version: '2.21',
        children: [{ id: 'button', type: 'frame', name: 'Primary Button', reusable: true }]
      })
    )
    const created = await cli(['convert', authored, '-o', source])
    expect(created.exitCode).toBe(0)

    const publish = (...extra: string[]) =>
      cli([
        'libraries',
        'publish',
        source,
        '--root',
        catalog,
        '--id',
        'ds',
        '--name',
        'DS',
        ...extra
      ])
    const latest = async () => {
      const listed = await cli(['libraries', 'list', '--root', catalog, '--json'])
      const [library] = v.parse(
        v.pipe(v.string(), v.parseJson(), v.array(librarySchema)),
        listed.stdout
      )
      return library?.latestRevisionId ?? ''
    }
    const authoredBytes = await readFile(source)

    const first = await publish()
    expect(first.exitCode).toBe(0)
    expect(first.stdout).toContain('1 component took an asset key from its name')
    expect(await readFile(source)).toEqual(authoredBytes)

    // A publication that fails leaves the source as it was, even with --write.
    const stale = await publish('--previous', 'stale', '--write')
    expect(stale.exitCode).not.toBe(0)
    expect(await readFile(source)).toEqual(authoredBytes)

    const saved = await publish('--previous', await latest(), '--write')
    expect(saved.exitCode).toBe(0)
    expect(saved.stdout).toContain('Saved 1 new asset key to')
    expect(await readFile(source)).not.toEqual(authoredBytes)

    // The next publication reads the key the source now keeps instead of giving a new one.
    const third = await publish('--previous', await latest())
    expect(third.exitCode).toBe(0)
    expect(third.stdout).not.toContain('asset key')

    const revision = await new FileSystemLibraryCatalog(catalog).getRevision('ds')
    expect(revision.manifest.assets.map((asset) => asset.key)).toEqual(['primary-button'])
  })
})
