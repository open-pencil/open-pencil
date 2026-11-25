import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { until } from '@vueuse/core'

import { materializeLibraryAsset } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'
import { DEADLINE_MS, sleep, withDeadline } from '@open-pencil/std/timing'

import { createEditorStore } from '@/app/editor/session'
import { LIBRARY_PREFIX, latestKey, revisionKey } from '@/app/integrations/storage/library-keys'
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
  useObjects
} from '#tests/helpers/libraries/sync-fixture'

let objects: MemoryObjects
const mirrorsToDelete: string[] = []

// Every wait here settles on local IndexedDB/memory work, so the request tier bounds them all.
const SYNC_SETTLE_DEADLINE_MS = DEADLINE_MS.request

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
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, async (signal) => {
      while (listCalls === 0) await sleep(10, signal)
    })
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
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, () =>
      until(
        () => librarySyncRemote.value !== null && librarySyncRemote.value.dbName !== firstName
      ).toBe(true)
    )
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
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, () =>
      until(
        () => librarySyncRemote.value !== null && librarySyncRemote.value.dbName !== first.dbName
      ).toBe(true)
    )
    await track()
    await flush()
    await whenLibrarySyncIdle()

    expect(librarySyncDiagnostics().parked).toBe(false)
    expect(
      (await librarySyncRemote.value?.catalog.listLibraries())?.map((row) => row.libraryId)
    ).toEqual(['design-system'])
  })

  test('a stale pass finishing after a remote rebuild cannot park the new remote', async () => {
    const [first] = await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    const editor = createEditorStore(new SceneGraph())
    registerNeedsProvider(editor)
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', { libraryId: 'design-system', revisionId: first, enabled: true })
    )
    startLibrarySync()
    const firstRemote = await track()
    await flush()
    await whenLibrarySyncIdle()

    // A second revision lands; the binding follows it. The next pass must probe — its
    // permanent manifest failure is the stale outcome that must not reach the rebuilt
    // remote — and pull, where the gate holds it in flight across the rebuild.
    const [second] = await seedLibrary(objects, 'design-system', 1, 'Library design-system', first)
    objects.getFailure = new S3HttpError(403, 'AccessDenied')
    const gate = createDeferred<undefined>()
    let pullInFlight = false
    const originalGet = objects.getObject.bind(objects)
    objects.getObject = async (key) => {
      if (key === revisionKey('design-system', second)) {
        pullInFlight = true
        await gate.promise
        return null // gone from the listing's point of view: a broken, unrepairable read
      }
      return originalGet(key)
    }
    void kickLibrarySync()
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', {
        libraryId: 'design-system',
        revisionId: second,
        enabled: true
      })
    )
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, async (signal) => {
      while (!pullInFlight) await sleep(10, signal)
    })
    objects.getFailure = null

    // The identity change rebuilds the remote while the old pass hovers. The rebuilt
    // remote's own pass is a fresh `attempts === 0` slate the stale outcome must not touch.
    writeStoragePreference('s3-compatible', 'bucket', 'other-bucket')
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, () =>
      until(
        () =>
          librarySyncRemote.value !== null && librarySyncRemote.value.dbName !== firstRemote.dbName
      ).toBe(true)
    )
    gate.resolve(undefined)
    objects.getObject = originalGet
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const diagnostics = librarySyncDiagnostics()
    expect(diagnostics.parked).toBe(false)
    expect(diagnostics.attempts).toBe(0)
    // And the rebuilt remote did pull the new revision itself.
    expect(
      await librarySyncRemote.value?.mirror.hasRevision('design-system', second)
    ).toBe(true)
  })

  test('a resume during an active pull keeps cleared failures cleared', async () => {
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
    registerNeedsProvider(editor)
    // The instance's origin revision joins the pass's needs permanently from now on.
    await kickLibrarySync({ includeInstanceRevs: true })
    // `first` is unrepairable on the remote: the pass records it failed, `second` lands.
    const originalGet = objects.getObject.bind(objects)
    objects.getObject = async (key) =>
      key === revisionKey('design-system', first) ? null : originalGet(key)
    startLibrarySync()
    await track()
    await flush()
    await whenLibrarySyncIdle()

    const failedKey = libraryResolutionKey('design-system', first)
    expect(librarySyncResolution.value.get(failedKey)).toBe('failed')
    objects.getObject = originalGet

    // A third revision arms the next pass's pull; the gate holds that pass in flight
    // with `first` already filed as failed inside its resolution snapshot.
    const [third] = await seedLibrary(objects, 'design-system', 1, 'Library design-system', second)
    const gate = createDeferred<undefined>()
    let pullInFlight = false
    objects.getObject = async (key) => {
      if (key === revisionKey('design-system', third)) {
        pullInFlight = true
        await gate.promise
      }
      return originalGet(key)
    }
    editor.updateEnabledLibraries((bindings) =>
      bindings.set('design-system', {
        libraryId: 'design-system',
        revisionId: third,
        enabled: true
      })
    )
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, async (signal) => {
      while (!pullInFlight) await sleep(10, signal)
    })

    // The resume clears every failed mark while the pass still hovers, then the pass
    // publishes its snapshot: pre-resume verdicts must not come back.
    await resumeLibrarySync()
    gate.resolve(undefined)
    objects.getObject = originalGet
    await whenLibrarySyncIdle()

    // The follow-up pass the resume queued re-derived `first` from the live needs and
    // mirrored it — had the snapshot republished its stale `failed`, the pass would have
    // skipped the key and left the verdict standing.
    const remote = librarySyncRemote.value
    if (!remote) throw new Error('Library sync remote did not come up')
    expect(await remote.mirror.hasRevision('design-system', first)).toBe(true)
    expect(await remote.mirror.hasRevision('design-system', third)).toBe(true)
    expect(librarySyncResolution.value.has(failedKey)).toBe(false)
  })

  test('a manifest without a listing etag is re-read on every probe', async () => {
    await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    // Listings of providers without etags cannot be diffed for free, so every probe
    // conservatively re-reads the manifest.
    const originalList = objects.listObjects.bind(objects)
    objects.listObjects = async (prefix) =>
      (await originalList(prefix)).map((entry) => ({ ...entry, etag: null }))
    objects.getCalls = 0
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { latestRevisionId: expect.any(String) }
    ])
    expect(objects.getCalls).toBe(1)

    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(2)
  })

  test('a manifest read without an object etag falls back to the listed etag', async () => {
    await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    // A read that cannot produce its own etag keeps the listing as the ordering currency:
    // the recorded etag must still suppress the next probe's GET.
    const originalValue = objects.getObjectValue.bind(objects)
    objects.getObjectValue = async (key) => {
      if (key !== latestKey('design-system')) return originalValue(key)
      objects.getCalls += 1
      return { bytes: objects.values.get(key) ?? null, etag: null }
    }
    objects.getCalls = 0
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system' }
    ])
    expect(objects.getCalls).toBe(1)

    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(1)
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
    // A publish puts the revision body before the manifest. While the manifest write is in
    // flight a listing can already show the new revision key, but the manifest's etag still
    // marks the old one — an unchanged etag must not fetch again.
    const staleEtag = (await objects.listObjects(`${LIBRARY_PREFIX}/`)).find(
      ({ key }) => key === latestKey('design-system')
    )?.etag
    if (!staleEtag) throw new Error('manifest missing before second publish')
    const [second] = await seedLibrary(objects, 'design-system', 1, 'Library design-system', first)
    const originalList = objects.listObjects.bind(objects)
    objects.listObjects = async (prefix) =>
      (await originalList(prefix)).map((entry) =>
        entry.key === latestKey('design-system') ? { ...entry, etag: staleEtag } : entry
      )
    objects.getCalls = 0
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(0)
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: first }
    ])

    // The manifest write commits: its etag changes, so the probe re-reads and the mirror
    // advances — even though nothing else about the listing has to change.
    objects.listObjects = originalList
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(1)
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: second }
    ])

    // An etag change alone re-reads: the provider rewrote the manifest object under an
    // identical revision key set.
    const manifestBytes = objects.values.get(latestKey('design-system'))
    if (!manifestBytes) throw new Error('manifest missing after second publish')
    await objects.putObject(latestKey('design-system'), manifestBytes)
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(2)
  })

  test('a read that lands past its listing records the read etag, not the listed one', async () => {
    const [first] = await seedLibrary(objects, 'design-system', 1)
    await useObjects(objects)
    startLibrarySync()
    const remote = await track()
    await flush()
    await whenLibrarySyncIdle()

    // A publish commits between the listing a probe diffs and the read it makes: the
    // listing still shows the stale etag while the object answers with its own, current
    // etag. Recording the listed etag would force an unneeded second read; recording the
    // read etag costs nothing and the projection stays exact.
    const [second] = await seedLibrary(objects, 'design-system', 1, 'Library design-system', first)
    const originalList = objects.listObjects.bind(objects)
    objects.listObjects = async (prefix) =>
      (await originalList(prefix)).map((entry) =>
        entry.key === latestKey('design-system') ? { ...entry, etag: 'listing-stale' } : entry
      )
    objects.getCalls = 0
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(1)
    expect(await remote.catalog.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: second }
    ])

    objects.listObjects = originalList
    await kickLibrarySync()
    await whenLibrarySyncIdle()
    expect(objects.getCalls).toBe(1)
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
    await withDeadline(SYNC_SETTLE_DEADLINE_MS, async (signal) => {
      while (!(await remote.mirror.hasRevision('design-system', first))) {
        await sleep(100, signal)
      }
    })
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
