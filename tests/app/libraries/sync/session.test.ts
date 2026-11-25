import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore } from '@/app/editor/session'
import { localLibraryCatalog, LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { libraryResolutionKey, librarySyncResolution } from '@/app/libraries/sync'
import { LibrarySyncSession, type PassRequest } from '@/app/libraries/sync/session'
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

  test('a closed session aborts instead of reporting its pass', async () => {
    await seedLibrary(objects, 'design-system', 1)
    const session = testSession(objects)
    await session.close()

    await expect(session.pass({ ...NEEDS_ONLY, probe: true }, [])).rejects.toMatchObject({
      name: 'AbortError'
    })
  })
})
