import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FileSystemLibraryCatalog } from '@open-pencil/cli/library'

describe('filesystem library catalog', () => {
  test('publishes and restores revisions under a bounded root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-'))
    const graph = new SceneGraph()
    graph.createNode('COMPONENT', graph.getPages()[0].id, {
      name: 'Button',
      componentKey: 'button'
    })
    const catalog = new FileSystemLibraryCatalog(root)
    const revision = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph,
      publishedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(await catalog.listLibraries()).toMatchObject([{ libraryId: 'design-system' }])
    expect((await catalog.getRevision('design-system')).manifest).toEqual(revision.manifest)
    expect(JSON.parse(await readFile(join(root, 'libraries.json'), 'utf8'))).toHaveLength(1)
  })

  test('rejects traversal and preserves malformed indexes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-'))
    const catalog = new FileSystemLibraryCatalog(root)
    await expect(catalog.getRevision('../outside')).rejects.toThrow('Invalid catalog path')
    await Bun.write(join(root, 'libraries.json'), '{invalid')
    await expect(catalog.listLibraries()).rejects.toBeInstanceOf(SyntaxError)
  })

  test('serializes concurrent publishers and keeps a valid index', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-'))
    const graph = new SceneGraph()
    graph.createNode('COMPONENT', graph.getPages()[0].id, {
      name: 'Button',
      componentKey: 'button'
    })
    const first = new FileSystemLibraryCatalog(root)
    const second = new FileSystemLibraryCatalog(root)
    const results = await Promise.allSettled([
      first.publishRevision({ libraryId: 'design-system', name: 'First', graph }),
      second.publishRevision({ libraryId: 'design-system', name: 'Second', graph })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await first.listLibraries()).toHaveLength(1)
    expect((await first.getRevision('design-system')).manifest.name).toBe('First')
  })
})
