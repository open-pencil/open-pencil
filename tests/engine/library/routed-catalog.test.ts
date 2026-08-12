import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { SceneGraph } from '@open-pencil/scene-graph'

import type { LibraryObjectStore } from '@/app/integrations/storage'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { RoutedLibraryCatalog } from '@/app/libraries/catalog/routed'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'

class MemoryObjects implements LibraryObjectStore {
  readonly values = new Map<string, Uint8Array>()
  fail = false
  async getObject(key: string) {
    if (this.fail) throw new Error('offline')
    return this.values.get(key) ?? null
  }
  async putObject(key: string, bytes: Uint8Array) {
    if (this.fail) throw new Error('offline')
    this.values.set(key, new Uint8Array(bytes))
  }
  async listObjects(prefix: string) {
    if (this.fail) throw new Error('offline')
    return [...this.values]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.byteLength, etag: null }))
  }
}

function graph() {
  const result = new SceneGraph()
  result.createNode('COMPONENT', result.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button'
  })
  return result
}

describe('routed library catalog', () => {
  test('caches remote revisions for offline retrieval', async () => {
    const objects = new MemoryObjects()
    const remote = new StorageLibraryCatalog(objects)
    const local = new LocalLibraryCatalog(`library-cache-${crypto.randomUUID()}`)
    const routed = new RoutedLibraryCatalog(local)
    routed.useStorage(remote)
    const published = await routed.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })
    objects.fail = true
    expect(
      (await routed.getRevision('design-system', published.manifest.revisionId)).manifest
    ).toEqual(published.manifest)
    expect(await routed.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: published.manifest.revisionId }
    ])
  })
})
