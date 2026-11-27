import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { effectScope, nextTick } from 'vue'

import {
  materializeLibraryAsset,
  MemoryLibraryCatalog,
  type ComponentLibraryRevision,
  type LibraryCatalog,
  type LibrarySummary,
  type PublishLibraryInput
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'

import { createEditorStore } from '@/app/editor/session'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import {
  LibraryContentFailedError,
  LibraryContentSyncingError,
  LibraryRevisionMissingError
} from '@/app/libraries/errors'
import { resetLibraryServiceForTests, useLibraryService } from '@/app/libraries/host'
import { writeLibraryCatalogSource } from '@/app/libraries/preferences'
import { LibraryService } from '@/app/libraries/service'
import {
  libraryResolutionKey,
  librarySyncRemote,
  librarySyncResolution,
  whenLibrarySyncReady,
  type LibrarySyncRemote
} from '@/app/libraries/sync'
import { currentNeedsProviders } from '@/app/libraries/sync/needs'

/** The remote view the engine publishes: a mirror plus the catalog wrapping it. */
function remoteView(mirror: LocalLibraryCatalog, name: string): LibrarySyncRemote {
  return {
    mirror,
    catalog: new MirroredLibraryCatalog(
      new LocalLibraryCatalog(`local-${name}-${crypto.randomUUID()}`),
      async () => null,
      mirror
    ),
    dbName: name
  }
}

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

function libraryGraph(width = 80) {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width
  })
  return graph
}

async function publish(
  catalog: LibraryCatalog,
  libraryId: string,
  width: number,
  previousRevisionId?: string
) {
  return catalog.publishRevision({
    libraryId,
    name: `Library ${libraryId}`,
    graph: libraryGraph(width),
    previousRevisionId
  })
}

/**
 * A service routed at storage whose mirror holds whatever the test published — the state the
 * sync engine leaves behind after a pull. `remote` counts calls so every assertion that reads
 * stay local is a number, not a type.
 */
async function mirroredService() {
  const origin = new MemoryLibraryCatalog()
  const remote = new CountingCatalog(origin)
  const mirror = new LocalLibraryCatalog(`mirror-${crypto.randomUUID()}`)
  let providerCalls = 0
  const catalog = new MirroredLibraryCatalog(
    new LocalLibraryCatalog(`local-${crypto.randomUUID()}`),
    async () => {
      providerCalls += 1
      return remote
    },
    mirror
  )
  catalog.useStorage()
  return {
    origin,
    remote,
    mirror,
    service: new LibraryService(catalog),
    providerCalls: () => providerCalls
  }
}

afterEach(() => {
  resetLibraryServiceForTests()
  librarySyncRemote.value = null
  librarySyncResolution.value = new Map()
  writeLibraryCatalogSource('local')
})

describe('local-first library service', () => {
  test('reads stay on the mirror once sync has run: refresh, groups and listComponents', async () => {
    const { origin, remote, mirror, service, providerCalls } = await mirroredService()
    const first = await publish(origin, 'design-system', 80)
    const latest = await publish(origin, 'design-system', 120, first.manifest.revisionId)
    // The engine's view of the world: both revisions mirrored, latest moved.
    await mirror.cacheRevision(first, false)
    await mirror.cacheRevision(latest, true)

    const document = new SceneGraph()
    const { componentId } = materializeLibraryAsset(document, first, 'button')
    document.createInstance(componentId, document.getPages()[0].id)
    const editor = createEditorStore(document)

    await service.refresh(editor)
    const groups = await service.getUpdateGroups(editor)
    const components = await service.forEditor(editor).listComponents({})

    expect(groups).toMatchObject([{ libraryId: 'design-system', assetKey: 'button' }])
    // The enabled row pins the bound revision, not the library's latest.
    expect(components).toMatchObject([
      {
        libraryId: 'design-system',
        revisionId: first.manifest.revisionId,
        enabled: true
      }
    ])
    expect(remote.calls.listLibraries).toBe(0)
    expect(remote.calls.getRevision).toBe(0)
    expect(remote.calls.publishRevision).toBe(0)
    expect(providerCalls()).toBe(0)
    // Watching the document registered it with the sync engine's needs providers.
    expect(currentNeedsProviders().includes(editor)).toBe(true)
  })

  test('enable resolves the bound revision from the manifest without reading the graph', async () => {
    const { origin, remote, mirror, service, providerCalls } = await mirroredService()
    const revision = await publish(origin, 'design-system', 80)
    await mirror.cacheRevision(revision)
    const getManifest = spyOn(mirror, 'getManifest')
    const getRevision = spyOn(mirror, 'getRevision')
    const editor = createEditorStore(new SceneGraph())

    await service.enable(editor, 'design-system')

    expect(editor.graph.enabledLibraries.get('design-system')).toMatchObject({
      revisionId: revision.manifest.revisionId,
      enabled: true
    })
    // Enabling and the refresh it triggers read manifests only — never a revision body.
    expect(getManifest.mock.calls.length).toBeGreaterThan(0)
    expect(getRevision.mock.calls.length).toBe(0)
    expect(remote.calls.getRevision).toBe(0)
    expect(providerCalls()).toBe(0)
  })

  test('enable binds the summary row’s latest while its revision still syncs', async () => {
    const { mirror, service } = await mirroredService()
    // The summary arrived; the revision body never did: the mid-sync mirror state a
    // manifest read used to deadlock on.
    await mirror.cacheSummary({
      libraryId: 'still-syncing',
      name: 'Still syncing',
      latestRevisionId: 'r-next',
      publishedAt: '2026-01-01T00:00:00.000Z',
      assetCount: 2
    })
    const getRevision = spyOn(mirror, 'getRevision')
    const editor = createEditorStore(new SceneGraph())

    await service.enable(editor, 'still-syncing')

    expect(editor.graph.enabledLibraries.get('still-syncing')).toMatchObject({
      revisionId: 'r-next',
      enabled: true
    })
    // Enabling needed no revision body at all: the summary row named the binding.
    expect(getRevision.mock.calls.length).toBe(0)
  })

  test('enable on a library the mirror never listed is not-found, never a binding', async () => {
    const { service } = await mirroredService()
    const editor = createEditorStore(new SceneGraph())

    await expect(service.enable(editor, 'ghost-library')).rejects.toThrow(
      LibraryRevisionMissingError
    )
    expect(editor.graph.enabledLibraries.has('ghost-library')).toBe(false)
  })

  test('insertComponent rejects a revision other than the bound one and names it', async () => {
    const { origin, mirror, service } = await mirroredService()
    const revision = await publish(origin, 'design-system', 80)
    await mirror.cacheRevision(revision)
    const document = new SceneGraph()
    materializeLibraryAsset(document, revision, 'button')
    const editor = createEditorStore(document)
    const catalog = service.forEditor(editor)

    await expect(
      catalog.insertComponent({
        libraryId: 'design-system',
        revisionId: 'a-stale-revision',
        assetKey: 'button'
      })
    ).rejects.toThrow(revision.manifest.revisionId)

    const inserted = await catalog.insertComponent({
      libraryId: 'design-system',
      assetKey: 'button'
    })
    expect(inserted.componentId).toBeTruthy()
    // The response pins the revision the instance was materialized from.
    expect(inserted.revisionId).toBe(revision.manifest.revisionId)
  })

  test('listComponents skips a library whose revision is still syncing', async () => {
    const { origin, mirror, service } = await mirroredService()
    const revision = await publish(origin, 'design-system', 80)
    await mirror.cacheRevision(revision)
    // The summary arrived but the revision body did not: a mid-sync mirror row.
    await mirror.cacheSummary({
      libraryId: 'half-synced',
      name: 'Half synced',
      latestRevisionId: 'r-not-yet',
      publishedAt: '2026-01-01T00:00:00.000Z',
      assetCount: 3
    })
    const editor = createEditorStore(new SceneGraph())

    const components = await service.forEditor(editor).listComponents({})
    expect(components.map((row) => row.libraryId)).toEqual(['design-system'])
  })

  test('a mirror miss the engine marked failed rejects with the failed error', async () => {
    const { service } = await mirroredService()

    await expect(service.getRevision('design-system', 'rev-missing')).rejects.toThrow(
      LibraryContentSyncingError
    )
    librarySyncResolution.value = new Map([
      [libraryResolutionKey('design-system', 'rev-missing'), 'failed']
    ])
    await expect(service.getRevision('design-system', 'rev-missing')).rejects.toThrow(
      LibraryContentFailedError
    )
  })

  test('the singleton service follows the sync engine remote across rebuilds', async () => {
    writeLibraryCatalogSource('storage')
    const service = useLibraryService()
    const originA = new MemoryLibraryCatalog()
    const mirrorA = new LocalLibraryCatalog(`mirror-a-${crypto.randomUUID()}`)
    await mirrorA.cacheRevision(await publish(originA, 'alpha', 80))

    const viewA = remoteView(mirrorA, 'remote-a')
    librarySyncRemote.value = viewA
    await nextTick()
    expect((await service.listLibraries()).map((row) => row.libraryId)).toEqual(['alpha'])

    // The engine rebuilt its remote onto a new mirror: the service reads that one now.
    const originB = new MemoryLibraryCatalog()
    const mirrorB = new LocalLibraryCatalog(`mirror-b-${crypto.randomUUID()}`)
    await mirrorB.cacheRevision(await publish(originB, 'beta', 80))
    const viewB = remoteView(mirrorB, 'remote-b')
    librarySyncRemote.value = viewB
    await nextTick()
    expect((await service.listLibraries()).map((row) => row.libraryId)).toEqual(['beta'])

    await mirrorA.close()
    await mirrorB.close()
  })

  test('the singleton keeps following the remote after the caller’s scope is disposed', async () => {
    writeLibraryCatalogSource('storage')
    const callerScope = effectScope()
    const service = callerScope.run(() => useLibraryService())
    if (!service) throw new Error('caller scope was inactive')
    // The component that first asked for the service unmounted; the cached singleton lives on.
    callerScope.stop()

    const origin = new MemoryLibraryCatalog()
    const mirror = new LocalLibraryCatalog(`mirror-scope-${crypto.randomUUID()}`)
    await mirror.cacheRevision(await publish(origin, 'gamma', 80))
    librarySyncRemote.value = remoteView(mirror, 'remote-after-dispose')
    await nextTick()

    expect((await service.listLibraries()).map((row) => row.libraryId)).toEqual(['gamma'])

    await mirror.close()
  })

  test('a revision read that lands after a catalog swap stays out of the new cache', async () => {
    const localA = new LocalLibraryCatalog(`local-a-${crypto.randomUUID()}`)
    const revisionA = await localA.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: libraryGraph(80)
    })
    const held = createDeferred<undefined>()
    const getRevisionA = localA.getRevision.bind(localA)
    localA.getRevision = async (libraryId, revisionId) => {
      await held.promise
      return getRevisionA(libraryId, revisionId)
    }
    const service = new LibraryService(
      new MirroredLibraryCatalog(
        localA,
        async () => null,
        new LocalLibraryCatalog(`mirror-a-${crypto.randomUUID()}`)
      )
    )
    const pending = service.getRevision('design-system', revisionA.manifest.revisionId)

    const localB = new LocalLibraryCatalog(`local-b-${crypto.randomUUID()}`)
    let bReads = 0
    const getRevisionB = localB.getRevision.bind(localB)
    localB.getRevision = async (libraryId, revisionId) => {
      bReads += 1
      return getRevisionB(libraryId, revisionId)
    }
    service.attachCatalog(
      new MirroredLibraryCatalog(
        localB,
        async () => null,
        new LocalLibraryCatalog(`mirror-b-${crypto.randomUUID()}`)
      )
    )
    held.resolve(undefined)

    // The caller still gets the revision its read returned.
    await expect(pending).resolves.toMatchObject({
      manifest: { revisionId: revisionA.manifest.revisionId }
    })

    // The same key on the new catalog is a miss there, so it was read, not served stale.
    await expect(
      service.getRevision('design-system', revisionA.manifest.revisionId)
    ).rejects.toThrow(LibraryRevisionMissingError)
    expect(bReads).toBe(1)
  })

  test('enable on the local catalog rejects a revision it cannot read and writes no binding', async () => {
    const local = new LocalLibraryCatalog(`local-${crypto.randomUUID()}`)
    const service = new LibraryService(
      new MirroredLibraryCatalog(
        local,
        async () => null,
        new LocalLibraryCatalog(`mirror-${crypto.randomUUID()}`)
      )
    )
    const editor = createEditorStore(new SceneGraph())

    await expect(service.enable(editor, 'design-system', 'rev-missing')).rejects.toThrow(
      LibraryRevisionMissingError
    )
    expect(editor.graph.enabledLibraries.has('design-system')).toBe(false)
  })

  test('enable on the local catalog binds a revision it can read', async () => {
    const local = new LocalLibraryCatalog(`local-${crypto.randomUUID()}`)
    const revision = await local.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: libraryGraph(80)
    })
    const service = new LibraryService(
      new MirroredLibraryCatalog(
        local,
        async () => null,
        new LocalLibraryCatalog(`mirror-${crypto.randomUUID()}`)
      )
    )
    const editor = createEditorStore(new SceneGraph())

    await service.enable(editor, 'design-system', revision.manifest.revisionId)

    expect(editor.graph.enabledLibraries.get('design-system')).toMatchObject({
      revisionId: revision.manifest.revisionId,
      enabled: true
    })
  })

  test('useStorageCatalog waits for nothing when the engine never started', async () => {
    const service = new LibraryService()
    await whenLibrarySyncReady()
    await service.useStorageCatalog()
    expect(service.catalogSource).toBe('storage')
  })
})
