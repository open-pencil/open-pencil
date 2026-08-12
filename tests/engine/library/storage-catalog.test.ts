import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { LibraryObjectStore } from '@/app/integrations/storage'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'

class MemoryObjects implements LibraryObjectStore {
  readonly values = new Map<string, Uint8Array>()

  async getObject(key: string) {
    return this.values.get(key) ?? null
  }

  async putObject(key: string, bytes: Uint8Array) {
    this.values.set(key, new Uint8Array(bytes))
  }

  async listObjects(prefix: string) {
    return [...this.values]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.byteLength, etag: null }))
  }
}

function sourceGraph() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('COMPONENT', page.id, { name: 'Button', componentKey: 'button' })
  return graph
}

describe('storage library catalog', () => {
  test('publishes immutable revision objects before the latest manifest', async () => {
    const objects = new MemoryObjects()
    const catalog = new StorageLibraryCatalog(objects)
    const revision = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: sourceGraph(),
      publishedAt: '2026-01-01T00:00:00.000Z'
    })

    expect([...objects.values.keys()]).toEqual([
      `open-pencil/libraries/design-system/revisions/${revision.manifest.revisionId}.json`,
      'open-pencil/libraries/design-system/manifest.json'
    ])
    expect(await catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: revision.manifest.revisionId }
    ])
    const restored = await catalog.getRevision('design-system')
    expect(restored.manifest).toEqual(revision.manifest)
    expect([...restored.graph.getAllNodes()].some((node) => node.componentKey === 'button')).toBe(
      true
    )
  })

  test('rejects corrupted revision content', async () => {
    const objects = new MemoryObjects()
    const catalog = new StorageLibraryCatalog(objects)
    const revision = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: sourceGraph()
    })
    const key = `open-pencil/libraries/design-system/revisions/${revision.manifest.revisionId}.json`
    const bytes = objects.values.get(key)
    if (!bytes) throw new Error('Expected revision object')
    const source = new TextDecoder().decode(bytes).replace('Button', 'Corrupted')
    objects.values.set(key, new TextEncoder().encode(source))
    await expect(
      catalog.getRevision('design-system', revision.manifest.revisionId)
    ).rejects.toThrow('hash mismatch')
  })

  test('rejects stale publication pointers', async () => {
    const catalog = new StorageLibraryCatalog(new MemoryObjects())
    await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: sourceGraph()
    })
    await expect(
      catalog.publishRevision({
        libraryId: 'design-system',
        name: 'Design system',
        graph: sourceGraph(),
        previousRevisionId: 'stale'
      })
    ).rejects.toThrow('latest revision has changed')
  })
})
