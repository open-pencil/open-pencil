import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile, rm, symlink, link, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'
import { deflateSync } from 'fflate'

import { exportFigFile, SceneGraph } from '@open-pencil/core'
import { parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

describe('diff snapshot CLI', () => {
  test.each(['same path', 'symlink', 'hard link'])(
    'rejects output identifying the input through %s',
    async (alias) => {
      const dir = await mkdtemp(join(tmpdir(), 'open-pencil-review-alias-'))
      try {
        const file = join(dir, 'design.fig')
        const original = Uint8Array.from(await exportFigFile(new SceneGraph()))
        await writeFile(file, original)
        const output = alias === 'same path' ? file : join(dir, 'alias.fig')
        if (alias === 'symlink') await symlink(file, output)
        if (alias === 'hard link') await link(file, output)
        const run = Bun.spawn(
          [process.execPath, CLI_ENTRY, 'diff', 'snapshot', file, '-o', output],
          { stdout: 'pipe', stderr: 'pipe' }
        )
        await new Response(run.stderr).text()
        expect(await run.exited).not.toBe(0)
        expect(Uint8Array.from(await readFile(file))).toEqual(original)
        expect(Uint8Array.from(await readFile(output))).toEqual(original)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    },
    60_000
  )

  test('cleans temporary output after replacement fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-review-write-'))
    try {
      const file = join(dir, 'design.fig')
      await writeFile(file, await exportFigFile(new SceneGraph()))
      const output = join(dir, 'review.json')
      await mkdir(output)
      const sentinel = join(output, 'keep.txt')
      await writeFile(sentinel, 'Keep existing output')
      const run = Bun.spawn([process.execPath, CLI_ENTRY, 'diff', 'snapshot', file, '-o', output], {
        stdout: 'pipe',
        stderr: 'pipe'
      })
      await new Response(run.stderr).text()
      expect(await run.exited).not.toBe(0)
      expect(await readFile(sentinel, 'utf8')).toBe('Keep existing output')
      expect((await readdir(dir)).sort()).toEqual(['design.fig', 'review.json'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
  test('independent CLI edits of the same base save different new layer GUIDs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-branches-'))
    try {
      const graph = new SceneGraph()
      const file = join(dir, 'base.fig')
      await writeFile(file, await exportFigFile(graph))
      const savedIds: string[] = []
      for (const branch of ['Left', 'Right']) {
        const output = join(dir, `${branch}.fig`)
        const run = Bun.spawn(
          [
            process.execPath,
            CLI_ENTRY,
            'eval',
            file,
            '--code',
            `const node = figma.createRectangle(); node.name = '${branch}';`,
            '-o',
            output,
            '--quiet'
          ],
          { stdout: 'pipe', stderr: 'pipe' }
        )
        const error = await new Response(run.stderr).text()
        expect(error).toBe('')
        expect(await run.exited).toBe(0)
        const bytes = await readFile(output)
        const record = parseFigBuffer(Uint8Array.from(bytes).buffer).nodeChanges.find(
          (node) => node.name === branch
        )
        if (!record?.guid) throw new Error(`Missing saved ${branch} record`)
        savedIds.push(guidToString(record.guid))
      }
      expect(savedIds[0]).not.toBe(savedIds[1])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)

  test('separate processes write identical review bytes to stdout and a file', async () => {
    await initCodec()
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-review-'))
    try {
      const file = join(dir, 'design.fig')
      const output = join(dir, 'review.json')
      await writeFile(
        file,
        writeFigArchive({
          schemaDeflated: deflateSync(getSchemaBytes()),
          kiwiData: encodeMessage(
            createNodeChangesMessage(0, 0, [
              { guid: { sessionID: 2, localID: 3 }, type: 'RECTANGLE', name: 'Stable' }
            ])
          ),
          thumbnailPNG: new Uint8Array(),
          metaJSON: '{}'
        })
      )
      const stdoutRun = Bun.spawn([process.execPath, CLI_ENTRY, 'diff', 'snapshot', file], {
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const text = await new Response(stdoutRun.stdout).text()
      expect(await stdoutRun.exited).toBe(0)
      await writeFile(output, 'Previous review')
      const fileRun = Bun.spawn(
        [process.execPath, CLI_ENTRY, 'diff', 'snapshot', file, '-o', output],
        { stdout: 'pipe', stderr: 'pipe' }
      )
      expect(await fileRun.exited).toBe(0)
      expect(await readFile(output, 'utf8')).toBe(text)
      expect(text).toContain('"2:3":')
      expect(text.endsWith('\n')).toBe(true)
      expect((await readdir(dir)).sort()).toEqual(['design.fig', 'review.json'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
