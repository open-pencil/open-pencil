import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { until } from '@vueuse/core'

import { materializeLibraryAsset } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'
import { sleep } from '@open-pencil/std/timing'

import { createEditorStore } from '@/app/editor/session'
import { latestKey, revisionKey } from '@/app/integrations/storage/library-keys'
import { writeStoragePreference } from '@/app/integrations/storage/preferences'
import { S3HttpError } from '@/app/integrations/storage/s3/client'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { LibraryService } from '@/app/libraries/service'
import {
  kickLibrarySync,
  libraryResolutionKey,
  librarySyncDiagnostics,
  librarySyncRemote,
  librarySyncResolution,
  registerNeedsProvider,
  resumeLibrarySync,
  startLibrarySync,
  whenLibrarySyncIdle
} from '@/app/libraries/sync'
import { isPermanentError } from '@/app/storage/sync/engine'

import {
  cleanupLibrarySyncTest,
  configureStorageFixture,
  flush,
  MemoryObjects,
  seedLibrary,
  trackMirror,
  useObjects,
  yieldEventLoop
} from '#tests/helpers/libraries/sync-fixture'

let objects: MemoryObjects
const mirrorsToDelete: string[] = []

beforeEach(() => {
  objects = new MemoryObjects()
  configureStorageFixture()
})

afterEach(async () => {
  await cleanupLibrarySyncTest(mirrorsToDelete)
})

function track() {
  return trackMirror(mirrorsToDelete)
}

describe('library sync engine', () => {
  test('probes the key listing once, then an unchanged listing costs zero GETs', async () => {
    await seedLibrary(objects, 'design-system', 2)
    objects.getCalls = 0
    objects.listCalls = 0
    await useObjects(objects)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    expect(objects.listCalls).toBe(1)
    expect(objects.getCalls).toBe(1) // only the manifest key, never a revision body
    expect(await librarySyncRemote.value?.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', assetCount: 1 }
    ])

    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.listCalls).toBe(2)
    expect(objects.getCalls).toBe(1)
  })

  test('a new library or revision key fetches only that library’s manifest', async () => {
    await seedLibrary(objects, 'alpha', 1)
    const [betaRevision] = await seedLibrary(objects, 'beta', 1)
    await useObjects(objects)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    await seedLibrary(objects, 'beta', 1, 'Library beta', betaRevision) // second revision
    await seedLibrary(objects, 'gamma', 1) // a new library
    objects.getCalls = 0
    await kickLibrarySync()
    await whenLibrarySyncIdle()

    expect(objects.getCalls).toBe(2)
    const summaries = await librarySyncRemote.value?.catalog.listLibraries()
    expect(summaries?.map((row) => row.libraryId).sort()).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('a removed manifest key drops the library from the mirror', async () => {
    await seedLibrary(objects, 'alpha', 1)
    await seedLibrary(objects, 'beta', 1)
    await useObjects(objects)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    objects.values.delete(latestKey('beta'))
    await kickLibrarySync()
    await whenLibrarySyncIdle()

    const summaries = await librarySyncRemote.value?.catalog.listLibraries()
    expect(summaries?.map((row) => row.libraryId)).toEqual(['alpha'])
  })

  test('binding changes pull needs without another listing', async () => {
    const [revision] = await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    const editor = createEditorStore(new SceneGraph())
    registerNeedsProvider(editor)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const listCalls = objects.listCalls
    const getCalls = objects.getCalls
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', {
        libraryId: 'design-system',
        revisionId: revision,
        enabled: true
      })
    )
    await whenLibrarySyncIdle()

    expect(objects.listCalls).toBe(listCalls)
    expect(objects.getCalls).toBe(getCalls + 1)
    const mirrored = await librarySyncRemote.value?.catalog.getRevision('design-system', revision)
    expect(mirrored?.manifest.revisionId).toBe(revision)
    expect(librarySyncResolution.value.has(libraryResolutionKey('design-system', revision))).toBe(
      false
    )
  })

  test('a permanent failure parks the engine and resume revives it', async () => {
    const [revision] = await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    const editor = createEditorStore(new SceneGraph())
    registerNeedsProvider(editor)
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', {
        libraryId: 'design-system',
        revisionId: revision,
        enabled: true
      })
    )
    objects.getFailure = new S3HttpError(403, 'AccessDenied')
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    expect(librarySyncDiagnostics().parked).toBe(true)
    expect(librarySyncResolution.value.get(libraryResolutionKey('design-system', revision))).toBe(
      'failed'
    )

    objects.getFailure = null
    await resumeLibrarySync()
    await whenLibrarySyncIdle()

    expect(librarySyncDiagnostics().parked).toBe(false)
    expect(
      librarySyncResolution.value.get(libraryResolutionKey('design-system', revision))
    ).toBeUndefined()
    const mirrored = await librarySyncRemote.value?.catalog.getRevision('design-system', revision)
    expect(mirrored?.manifest.revisionId).toBe(revision)
  })

  test('kicks landing during a pull merge into one follow-up pass', async () => {
    await useObjects(objects)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    // Gate the listing so the next probe stays in flight while more kicks arrive.
    const gate = createDeferred<undefined>()
    const originalList = objects.listObjects.bind(objects)
    let listCalls = 0
    objects.listObjects = async (prefix) => {
      listCalls += 1
      await gate.promise
      return originalList(prefix)
    }

    void kickLibrarySync()
    void kickLibrarySync()
    for (;;) {
      if (listCalls > 0) break
      await yieldEventLoop()
    }
    void kickLibrarySync()
    void kickLibrarySync()
    gate.resolve(undefined)
    await whenLibrarySyncIdle()

    expect(listCalls).toBe(2) // the in-flight probe plus exactly one merged rerun
  })

  test('a remote identity change rebuilds the mirror and re-probes', async () => {
    await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    startLibrarySync()
    const first = await track()
    await flush()
    await whenLibrarySyncIdle()
    const firstName = first.dbName

    writeStoragePreference('s3-compatible', 'bucket', 'other-bucket')
    await until(
      () => librarySyncRemote.value !== null && librarySyncRemote.value.dbName !== firstName
    ).toBe(true)
    const second = await track()
    await flush()
    await whenLibrarySyncIdle()

    expect(second.dbName).not.toBe(firstName)
    expect(second.mirror).not.toBe(first.mirror)
    expect(await second.catalog.listLibraries()).toMatchObject([{ libraryId: 'design-system' }])
  })

  test('isPermanentError classifies by S3HttpError status', () => {
    expect(isPermanentError(new S3HttpError(412, 'PreconditionFailed'))).toBe(true)
    expect(isPermanentError(new S3HttpError(401, 'Unauthorized'))).toBe(true)
    expect(isPermanentError(new S3HttpError(403, 'AccessDenied'))).toBe(true)
    expect(isPermanentError(new S3HttpError(503, 'ServiceUnavailable'))).toBe(false)
    expect(isPermanentError(new TypeError('Failed to fetch'))).toBe(false)
    // Deliberate contract change: non-S3 errors are never credential failures, so the
    // old "access denied" message match no longer parks — it backs off instead.
    expect(isPermanentError(new Error('access denied'))).toBe(false)
  })

  test('a transient listing failure backs off instead of parking', async () => {
    await useObjects(objects)
    objects.listFailure = new S3HttpError(503, 'ServiceUnavailable')
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const diagnostics = librarySyncDiagnostics()
    expect(diagnostics.parked).toBe(false)
    expect(diagnostics.attempts).toBe(1)
    expect(diagnostics.nextAttemptAt).toBeGreaterThan(Date.now())
  })

  test('a remote rebuild revives an engine parked on the old remote', async () => {
    await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    objects.getFailure = new S3HttpError(403, 'AccessDenied')
    startLibrarySync()
    const first = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(librarySyncDiagnostics().parked).toBe(true)

    objects.getFailure = null
    writeStoragePreference('s3-compatible', 'bucket', 'other-bucket')
    await until(
      () => librarySyncRemote.value !== null && librarySyncRemote.value.dbName !== first.dbName
    ).toBe(true)
    await track()
    await flush()
    await whenLibrarySyncIdle()

    expect(librarySyncDiagnostics().parked).toBe(false)
    expect(
      (await librarySyncRemote.value?.catalog.listLibraries())?.map((row) => row.libraryId)
    ).toEqual(['design-system'])
  })

  test('a manifest ahead of its listing is read again until the listing catches up', async () => {
    const [, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    // The probe's listing predates the publish the manifest already shows.
    const originalList = objects.listObjects.bind(objects)
    let stale = true
    objects.listObjects = async (prefix) => {
      const listed = await originalList(prefix)
      return stale
        ? listed.filter(({ key }) => key !== revisionKey('design-system', second))
        : listed
    }
    objects.getCalls = 0
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([{ latestRevisionId: second }])
    expect(objects.getCalls).toBe(1)

    // The listing never named `second`, so the manifest read is not accounted for.
    stale = false
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(2)

    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(2)
  })

  test('a manifest behind its own listing is requeued, never cached', async () => {
    const [first] = await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: first }
    ])

    // A publish puts the revision body before the manifest. Between those two PUTs the
    // listing already shows the new revision key while the manifest still names the old
    // latest — the mirror must not cache it and forget.
    const staleManifest = objects.values.get(latestKey('design-system'))
    if (!staleManifest) throw new Error('manifest missing before second publish')
    const [second] = await seedLibrary(objects, 'design-system', 1, 'Library design-system', first)
    const originalGet = objects.getObject.bind(objects)
    objects.getObject = async (key) =>
      key === latestKey('design-system') ? staleManifest : originalGet(key)
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: first }
    ])

    objects.getObject = originalGet
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: second }
    ])
  })

  test('a flagged need stays syncing through a transient failure until it lands', async () => {
    const [first, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    const document = new SceneGraph()
    const revision = await new StorageLibraryCatalog(objects).getRevision('design-system', first)
    materializeLibraryAsset(document, revision, 'button')
    // The document moved its binding on; only the instance still wants the old revision.
    document.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: second,
      enabled: true
    })
    const editor = createEditorStore(document)
    registerNeedsProvider(editor)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const remote = librarySyncRemote.value
    if (!remote) throw new Error('Library sync remote did not come up')
    const key = libraryResolutionKey('design-system', first)
    expect(await remote.mirror.hasRevision('design-system', first)).toBe(false)

    // The flag-raised pull fails transiently; unflagged kicks keep retrying it.
    objects.getFailure = new Error('flaky')
    await kickLibrarySync({ probe: false, includeInstanceRevs: true })
    await whenLibrarySyncIdle()
    expect(librarySyncResolution.value.get(key)).toBe('syncing')

    objects.getFailure = null
    // The transient failure armed the retry wake (~1s): unflagged work still re-pulls
    // the need the flag raised.
    for (let waited = 0; waited < 10_000; waited += 100) {
      if (await remote.mirror.hasRevision('design-system', first)) break
      await sleep(100)
    }
    expect(await remote.mirror.hasRevision('design-system', first)).toBe(true)
    expect(librarySyncResolution.value.has(key)).toBe(false)
    // Keep the provider alive through the backoff: needs come from live stores only.
    expect(editor.graph.enabledLibraries.has('design-system')).toBe(true)
  }, 15_000)

  test('getUpdateGroups asks the engine for the revisions instances came from', async () => {
    const [first, second] = await seedLibrary(objects, 'design-system', 2)
    await useObjects(objects)
    const document = new SceneGraph()
    const revision = await new StorageLibraryCatalog(objects).getRevision('design-system', first)
    materializeLibraryAsset(document, revision, 'button')
    document.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: second,
      enabled: true
    })
    const editor = createEditorStore(document)
    const service = new LibraryService()
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    remote.catalog.useStorage()
    service.attachCatalog(remote.catalog)
    await service.refresh(editor)

    expect(await remote.mirror.hasRevision('design-system', first)).toBe(false)
    await service.getUpdateGroups(editor)
    await whenLibrarySyncIdle()

    expect(await remote.mirror.hasRevision('design-system', first)).toBe(true)
  })
})
