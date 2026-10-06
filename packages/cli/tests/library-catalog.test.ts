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
    await expect(catalog.listLibraries()).rejects.toThrow(
      'Invalid library catalog file libraries.json'
    )
    await Bun.write(join(root, 'libraries.json'), '[{"libraryId":1}]')
    await expect(catalog.listLibraries()).rejects.toThrow(
      'Invalid library catalog file libraries.json'
    )
  })

  test('restores image bytes from stored revisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-'))
    const graph = new SceneGraph()
    graph.images.set('image-hash', new Uint8Array([1, 2, 3]))
    graph.createNode('COMPONENT', graph.getPages()[0].id, {
      name: 'Avatar',
      componentKey: 'avatar',
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image-hash',
          visible: true,
          opacity: 1,
          color: { r: 0, g: 0, b: 0, a: 1 },
          blendMode: 'NORMAL'
        }
      ]
    })
    const catalog = new FileSystemLibraryCatalog(root)
    await catalog.publishRevision({ libraryId: 'design-system', name: 'Design system', graph })
    const restored = await catalog.getRevision('design-system')
    expect(restored.graph.images.get('image-hash')).toEqual(new Uint8Array([1, 2, 3]))
  })

  test('rejects revisions that are malformed or fail integrity validation', async () => {
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
      graph
    })
    const path = join(root, 'design-system/revisions', `${revision.manifest.revisionId}.json`)
    const stored = await readFile(path, 'utf8')
    const contentHash = revision.manifest.assets[0]?.contentHash ?? ''

    await Bun.write(path, JSON.stringify({ manifest: revision.manifest, graph: { nodes: 'none' } }))
    await expect(catalog.getRevision('design-system')).rejects.toThrow(
      'Invalid library catalog file'
    )

    await Bun.write(path, stored.replaceAll(contentHash, 'tampered'))
    await expect(catalog.getRevision('design-system')).rejects.toThrow(
      'Component library content hash mismatch'
    )
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
