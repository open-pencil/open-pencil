import { describe, expect, spyOn, test } from 'bun:test'

import 'fake-indexeddb/auto'

import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import type { LibraryObjectStore } from '@/app/integrations/storage'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { LibraryContentSyncingError } from '@/app/libraries/errors'

class MemoryObjects implements LibraryObjectStore {
  readonly values = new Map<string, Uint8Array>()
  readonly etags = new Map<string, string>()
  #version = 0

  async getObject(key: string) {
    return this.values.get(key) ?? null
  }

  async getObjectValue(key: string) {
    return { bytes: await this.getObject(key), etag: this.etags.get(key) ?? null }
  }

  async putObject(
    key: string,
    bytes: Uint8Array,
    _contentType?: string,
    options?: { ifMatch?: string; ifNoneMatch?: '*' }
  ) {
    const current = this.etags.get(key)
    if (options?.ifNoneMatch === '*' && current) throw new Error('revision conflict')
    if (options?.ifMatch && options.ifMatch !== current) throw new Error('revision conflict')
    this.values.set(key, new Uint8Array(bytes))
    this.#version += 1
    this.etags.set(key, `etag-${this.#version}`)
  }

  async listObjects(prefix: string) {
    return [...this.values]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.byteLength, etag: null }))
  }
}

/** Counts calls so tests prove reads stay local and only publishes reach the remote. */
class CountingCatalog implements LibraryCatalog {
  readonly #catalog: LibraryCatalog
  readonly calls = { listLibraries: 0, getRevision: 0, publishRevision: 0 }

  constructor(catalog: LibraryCatalog) {
    this.#catalog = catalog
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    this.calls.listLibraries += 1
    return this.#catalog.listLibraries()
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    this.calls.getRevision += 1
    return this.#catalog.getRevision(libraryId, revisionId)
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    this.calls.publishRevision += 1
    return this.#catalog.publishRevision(input)
  }
}

function isolatedCatalog(): LocalLibraryCatalog {
  return new LocalLibraryCatalog(`library-cache-${crypto.randomUUID()}`)
}

function graph() {
  const result = new SceneGraph()
  result.createNode('COMPONENT', result.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button'
  })
  return result
}

describe('mirrored library catalog', () => {
  test('local source delegates to the local catalog and touches neither remote nor mirror', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const local = isolatedCatalog()
    const mirror = isolatedCatalog()
    const catalog = new MirroredLibraryCatalog(local, async () => remote, mirror)

    const published = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })

    expect(remote.calls.publishRevision).toBe(0)
    expect(objects.values.size).toBe(0)
    expect(await mirror.getManifest('design-system')).toBeNull()
    expect(
      (await catalog.getRevision('design-system', published.manifest.revisionId)).manifest
    ).toEqual(published.manifest)
    expect(await catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: published.manifest.revisionId }
    ])
  })

  test('storage source serves reads from the mirror and never calls the remote', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const local = isolatedCatalog()
    const mirror = isolatedCatalog()
    const catalog = new MirroredLibraryCatalog(local, async () => remote, mirror)
    catalog.useStorage()

    const published = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })
    expect(remote.calls.publishRevision).toBe(1)
    expect(await mirror.getManifest('design-system')).toMatchObject({
      revisionId: published.manifest.revisionId
    })

    expect(await catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: published.manifest.revisionId }
    ])
    expect(
      (await catalog.getRevision('design-system', published.manifest.revisionId)).manifest
    ).toEqual(published.manifest)
    // An omitted revision resolves through the mirror's latest pointer, still locally.
    expect((await catalog.getRevision('design-system')).manifest.revisionId).toBe(
      published.manifest.revisionId
    )
    expect((await catalog.getManifest('design-system')).revisionId).toBe(
      published.manifest.revisionId
    )
    expect(remote.calls.listLibraries).toBe(0)
    expect(remote.calls.getRevision).toBe(0)
  })

  test('publish resolves the remote lazily through the provider', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const catalog = new MirroredLibraryCatalog(
      isolatedCatalog(),
      async () => remote,
      isolatedCatalog()
    )
    catalog.useStorage()

    const published = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })
    expect(remote.calls.publishRevision).toBe(1)
    expect(published.manifest.libraryId).toBe('design-system')
  })

  test('a mirror miss reports the content as still syncing', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const catalog = new MirroredLibraryCatalog(
      isolatedCatalog(),
      async () => remote,
      isolatedCatalog()
    )
    catalog.useStorage()

    await expect(catalog.getRevision('design-system')).rejects.toThrow(LibraryContentSyncingError)
    await expect(catalog.getManifest('design-system', 'rev-1')).rejects.toThrow(
      LibraryContentSyncingError
    )
    expect(remote.calls.listLibraries).toBe(0)
    expect(remote.calls.getRevision).toBe(0)
  })

  test('publish without a resolvable remote reports the catalog as unavailable', async () => {
    const catalog = new MirroredLibraryCatalog(
      isolatedCatalog(),
      async () => null,
      isolatedCatalog()
    )
    catalog.useStorage()

    await expect(
      catalog.publishRevision({ libraryId: 'design-system', name: 'Design system', graph: graph() })
    ).rejects.toThrow('Library catalog is not configured')
  })

  test('a failed mirror write still returns the published revision and schedules a resync', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const mirror = isolatedCatalog()
    let resyncs = 0
    const catalog = new MirroredLibraryCatalog(
      isolatedCatalog(),
      async () => remote,
      mirror,
      () => {
        resyncs += 1
      }
    )
    catalog.useStorage()
    spyOn(mirror, 'cacheRevision').mockRejectedValueOnce(new Error('disk full'))

    const published = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })
    expect(remote.calls.publishRevision).toBe(1)
    expect(published.manifest.libraryId).toBe('design-system')
    expect(resyncs).toBe(1)
  })

  test('switching back to local reads the local catalog again', async () => {
    const objects = new MemoryObjects()
    const remote = new CountingCatalog(new StorageLibraryCatalog(objects))
    const local = isolatedCatalog()
    const catalog = new MirroredLibraryCatalog(local, async () => remote, isolatedCatalog())

    const published = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: graph()
    })
    catalog.useStorage()
    catalog.useLocal()

    expect(await catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: published.manifest.revisionId }
    ])
    expect(remote.calls.listLibraries).toBe(0)
    expect(remote.calls.getRevision).toBe(0)
  })
})
