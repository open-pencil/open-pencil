import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createDeferred } from '@open-pencil/std/async'

import { createEditorStore } from '@/app/editor/session'
import { localLibraryCatalog, LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { libraryResolutionKey, librarySyncResolution } from '@/app/libraries/sync'
import { LibrarySyncSession, type PassRequest } from '@/app/libraries/sync/session'
import { clearFailedResolutions } from '@/app/libraries/sync/status'
import { deleteAppDatabase } from '@/app/storage/idb'

import { MemoryObjects, seedLibrary } from '#tests/helpers/libraries/sync-fixture'

const NEEDS_ONLY: PassRequest = {
  probe: false,
  includeInstanceRevs: false,
  includePublication: false
}

let objects: MemoryObjects
const sessions: LibrarySyncSession[] = []
const databases: string[] = []

beforeEach(() => {
  objects = new MemoryObjects()
})

afterEach(async () => {
  librarySyncResolution.value = new Map()
  for (const session of sessions.splice(0)) await session.close()
  for (const name of databases.splice(0)) await deleteAppDatabase(name).catch(() => undefined)
})

/** A session on a real mirror, reading the given object store. */
function testSession(store: MemoryObjects): LibrarySyncSession {
  const dbName = `session-${crypto.randomUUID()}`
  databases.push(dbName)
  const mirror = new LocalLibraryCatalog(dbName)
  const catalog = new MirroredLibraryCatalog(
    localLibraryCatalog,
    async () => new StorageLibraryCatalog(store),
    mirror
  )
  catalog.useStorage()
  const session = new LibrarySyncSession(mirror, catalog, dbName, async () => store)
  sessions.push(session)
  return session
}

function bindingTo(libraryId: string, revisionId: string) {
  const editor = createEditorStore(new SceneGraph())
  editor.updateEnabledLibraries((bindings) =>
    bindings.set(libraryId, { libraryId, revisionId, enabled: true })
  )
  return editor
}

describe('library sync session', () => {
  test('a needs pull never moves the latest row back', async () => {
    const [, second, third] = await seedLibrary(objects, 'design-system', 3)
    const session = testSession(objects)
    // The pass listed and summarized up to `second`; a concurrent publish already wrote
    // `third` into the mirror. Pulling `second` — the latest as this pass knew it — must
    // not roll the row back.
    await session.mirror.cacheRevision(
      await new StorageLibraryCatalog(objects).getRevision('design-system', third)
    )
    const realList = session.mirror.listLibraries.bind(session.mirror)
    let doctored = true
    session.mirror.listLibraries = async () =>
      doctored
        ? (await realList()).map((row) =>
            row.libraryId === 'design-system' ? { ...row, latestRevisionId: second } : row
          )
        : realList()

    await session.pass(NEEDS_ONLY, [bindingTo('design-system', second)])
    doctored = false

    expect(await session.mirror.hasRevision('design-system', second)).toBe(true)
    expect(await session.mirror.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: third }
    ])
  })

  test('a failed mark set before a pass starts keeps the revision failed', async () => {
    const [first] = await seedLibrary(objects, 'design-system', 1)
    const session = testSession(objects)
    const key = libraryResolutionKey('design-system', first)
    librarySyncResolution.value = new Map([[key, 'failed']])

    await session.pass(NEEDS_ONLY, [bindingTo('design-system', first)])

    expect(librarySyncResolution.value.get(key)).toBe('failed')
    expect(await session.mirror.hasRevision('design-system', first)).toBe(false)
  })

  test('a probe that failed after the listing reads the manifest again next pass', async () => {
    await seedLibrary(objects, 'design-system', 1)
    const session = testSession(objects)
    const realList = session.mirror.listLibraries.bind(session.mirror)
    let firstRead = true
    session.mirror.listLibraries = async () => {
      if (firstRead) {
        firstRead = false
        throw new Error('mirror read aborted')
      }
      return realList()
    }

    const failed = await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    expect(failed.transient).toBeInstanceOf(Error)

    // The key set a failed probe saw must not count as accounted for.
    await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    expect(await session.mirror.listLibraries()).toMatchObject([{ libraryId: 'design-system' }])
  })

  test('a rejected probe summary records no etag, so the next probe re-reads until it heals', async () => {
    const catalog = new StorageLibraryCatalog(objects)
    const first = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Library design-system',
      graph: new SceneGraph()
    })
    // Capture the stale manifest before the chain advances.
    const staleManifest = objects.values.get(`open-pencil/libraries/design-system/manifest.json`)
    if (!staleManifest) throw new Error('first manifest missing')
    const second = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Library design-system',
      graph: new SceneGraph(),
      previousRevisionId: first.manifest.revisionId
    })
    const healedManifest = objects.values.get(`open-pencil/libraries/design-system/manifest.json`)
    if (!healedManifest) throw new Error('second manifest missing')
    // The remote's manifest rolls back to the parent — for good or through a lost write —
    // while the mirror already knows the child: a probe reading it must be rejected.
    await objects.putObject(`open-pencil/libraries/design-system/manifest.json`, staleManifest)
    const session = testSession(objects)
    await session.mirror.cacheRevision(
      await catalog.getRevision('design-system', second.manifest.revisionId)
    )
    const countManifestReads = () => {
      const reads = objects.getCalls
      objects.getCalls = 0
      return reads
    }
    objects.getCalls = 0

    await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    // The stored row keeps naming the child: the stale manifest's summary is a proven
    // ancestor of the mirror's head.
    expect(await session.mirror.listLibraries()).toMatchObject([
      { libraryId: 'design-system', latestRevisionId: second.manifest.revisionId }
    ])
    expect(countManifestReads()).toBe(1)

    // The rejection must not record the etag: the next probe reads the manifest again
    // instead of skipping it as unchanged. Re-reads are the safe direction for a rare
    // rejection; a recorded etag here wedged the row forever.
    await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    expect(countManifestReads()).toBe(1)

    // Once the remote's manifest advances back onto the chain, the probe accepts it,
    // records the etag, and an unchanged listing costs zero further GETs.
    await objects.putObject(`open-pencil/libraries/design-system/manifest.json`, healedManifest)
    await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    expect(countManifestReads()).toBe(1)
    await session.pass({ ...NEEDS_ONLY, probe: true }, [])
    expect(countManifestReads()).toBe(0)
  })

  test('a closed session aborts instead of reporting its pass', async () => {
    await seedLibrary(objects, 'design-system', 1)
    const session = testSession(objects)
    await session.close()

    await expect(session.pass({ ...NEEDS_ONLY, probe: true }, [])).rejects.toMatchObject({
      name: 'AbortError'
    })
  })

  test('a pass opened before a resume does not fail the rows the resume cleared', async () => {
    const [first] = await seedLibrary(objects, 'design-system', 1)
    const key = libraryResolutionKey('design-system', first)
    // A row the previous pass published as syncing — the resume clears it along with the
    // failed verdicts, and the follow-up pass re-derives the need on its own.
    librarySyncResolution.value = new Map([[key, 'syncing']])

    // The pass hangs inside openObjects: when it finally fails, its `!objects` branch is
    // where syncing rows would settle as failed.
    const gate = createDeferred<undefined>()
    let calls = 0
    const session = testSession(objects)
    const openObjects = async () => {
      calls += 1
      await gate.promise
      throw new Error('storage unreachable')
    }
    const controlled = new LibrarySyncSession(
      session.mirror,
      session.catalog,
      session.dbName,
      openObjects
    )
    sessions.push(controlled)
    const pass = controlled.pass(NEEDS_ONLY, [])
    expect(calls).toBe(1)

    // The resume lands while the pass hovers: it voids every pre-resume verdict, so the
    // failure this pass is about to settle belongs to a dead generation.
    clearFailedResolutions()
    gate.resolve(undefined)
    await pass

    expect(librarySyncResolution.value.get(key)).toBe('syncing')
  })
})
