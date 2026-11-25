import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import { LIBRARY_PREFIX, latestKey } from '@/app/integrations/storage/library-keys'
import {
  kickLibrarySync,
  librarySyncRemote,
  startLibrarySync,
  whenLibrarySyncIdle
} from '@/app/libraries/sync'

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

describe('library sync engine probes', () => {
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
    expect(await remote.catalog.listLibraries()).toMatchObject([{ libraryId: 'design-system' }])
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
})
