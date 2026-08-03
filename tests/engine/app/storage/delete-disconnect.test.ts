import { afterEach, describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { setBackupToCloud } from '@/app/storage/backup'
import { disconnectStorageTarget } from '@/app/storage/disconnect'
import {
  permanentlyDeleteStorageDocument,
  type StorageDocumentMutationDependencies
} from '@/app/storage/documents'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import { createMemoryOutbox, resetOutboxForTests, type Outbox } from '@/app/storage/sync/outbox'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import type { StorageTargetID } from '@/app/storage/target'

import { createHarness, recordingAdapter, settle, type Harness } from './sync/harness'

/**
 * The two transitions where a delete decision has to survive a later listing.
 *
 * Permanent delete and disconnect are the only paths that can lose a document
 * the user still wants, or resurrect one they deleted. The pause case carries
 * the most: it is the only one where the user removes a document whose remote
 * copy deliberately stays behind, so the tombstone is the ONLY thing standing
 * between them and the next listing re-seeding it.
 */

const PROVIDER = 's3-compatible'
const TARGET: StorageTargetID = 's3-compatible#aaaaaaaa'
const OTHER_TARGET: StorageTargetID = 's3-compatible#bbbbbbbb'
const BODY = new Uint8Array(256).fill(9)

type World = {
  store: LocalCanvasStore
  outbox: Outbox
  harness: Harness
  /** Reach the network and run the queue to completion. */
  drain(): Promise<void>
  dispose(): void
}

const openWorlds: World[] = []

/** An engine that is offline until a test explicitly drains it. */
function createWorld(): World {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  const adapter = recordingAdapter()
  let online = false
  const harness = createHarness({
    getStore: () => store,
    getOutbox: () => outbox,
    adapter,
    isOnline: () => online
  })
  resetLocalCanvasStoreForTests(store)
  resetOutboxForTests(outbox)

  const world: World = {
    store,
    outbox,
    harness,
    async drain() {
      online = true
      for (let pass = 0; pass < 12; pass++) {
        await harness.engine.kick()
        await harness.drainWakes()
        if ((await outbox.list()).length === 0) break
      }
      online = false
    },
    dispose() {
      harness.dispose()
      resetLocalCanvasStoreForTests()
      resetOutboxForTests()
    }
  }
  openWorlds.push(world)
  return world
}

function documentDeps(world: World): StorageDocumentMutationDependencies {
  return {
    store: world.store,
    adapter: world.harness.adapter,
    persist: (options) =>
      persistStorageCanvasLocally(options, {
        store: world.store,
        enqueueCanvas: (id, revision) => world.harness.engine.enqueuePutCanvas(id, revision)
      }),
    enqueueMetadata: (id, revision) => world.harness.engine.enqueuePutMetadata(id, revision),
    enqueueDelete: (id) => world.harness.engine.enqueueDeleteCanvas(id),
    createId: () => 'copy'
  }
}

/** Commit through the path autosave takes, then let the destination receive it. */
async function seedDocument(
  world: World,
  id: string,
  targetId: StorageTargetID | null,
  options: { upload?: boolean } = {}
): Promise<StorageDocument> {
  await persistStorageCanvasLocally(
    { syncTargetId: targetId, canvasId: id, name: id, trashedAt: null, figBytes: BODY },
    {
      store: world.store,
      enqueueCanvas: (canvasId, revision) =>
        world.harness.engine.enqueuePutCanvas(canvasId, revision)
    }
  )
  if (options.upload !== false) await world.drain()
  await settle()
  const meta = await world.store.getMeta(id)
  if (!meta) throw new Error(`seed failed for ${id}`)
  return {
    id,
    name: meta.name,
    sourceFormat: meta.sourceFormat,
    updatedAt: meta.updatedAt,
    trashedAt: null,
    metadataAuthoritative: true
  }
}

/** A row that exists only because a listing named it — no local bytes. */
async function seedIndexRow(world: World, id: string, targetId: StorageTargetID): Promise<void> {
  await world.store.upsertIndexMeta({
    id,
    syncTargetId: targetId,
    name: id,
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: null
  })
}

/** What the bucket would report for these ids on the next refresh. */
function remoteListing(ids: string[]): StorageDocument[] {
  return ids.map((id) => ({
    id,
    name: id,
    sourceFormat: 'fig' as const,
    updatedAt: '2026-01-01T00:00:00.000Z',
    trashedAt: null,
    metadataAuthoritative: false
  }))
}

/** Ids a refresh against `remote` would put on screen. */
async function visibleAfterRefresh(world: World, remote: string[]): Promise<string[]> {
  const local = await world.store.listMetas(true)
  return reconcileStorageDocuments(local, remoteListing(remote)).documents.map(
    (document) => document.id
  )
}

afterEach(() => {
  for (const world of openWorlds.splice(0)) world.dispose()
  setBackupToCloud(true)
})

describe('permanent delete', () => {
  test('a local-only document is removed outright, bytes and all', async () => {
    const world = createWorld()
    const document = await seedDocument(world, 'doc', null)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    // No destination was ever recorded, so no remote object can exist and a
    // tombstone would be a hidden row nothing ever purges.
    expect(await world.store.getMeta('doc')).toBeNull()
    expect(await world.store.readFig('doc')).toBeNull()
    expect(await world.outbox.list()).toEqual([])
    await world.drain()
    expect(world.harness.adapter.calls).toEqual([])
  })

  test('a paused replica keeps a tombstone, reclaims the bytes, and leaves the bucket alone', async () => {
    const world = createWorld()
    const document = await seedDocument(world, 'doc', TARGET)
    expect(world.harness.adapter.bodies.has('doc')).toBe(true)
    setBackupToCloud(false)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    const meta = await world.store.getMeta('doc')
    expect(meta?.tombstoned).toBe(true)
    // `local`, not `pending`: no job exists and none may be created while
    // paused, so `pending` would be a promise nothing can keep.
    expect(meta?.syncStatus).toBe('local')
    expect(meta?.syncTargetId).toBe(TARGET)
    expect(meta?.hasFig).toBe(false)
    expect(await world.store.readFig('doc')).toBeNull()
    expect(await world.outbox.list()).toEqual([])

    // The whole point of the pause: the remote copy survives untouched.
    await world.drain()
    expect(world.harness.adapter.count('delete')).toBe(0)
    expect(world.harness.adapter.bodies.has('doc')).toBe(true)

    // And the object still being in the bucket is exactly why the tombstone has
    // to stay — this listing would otherwise re-seed the deleted document.
    expect(await visibleAfterRefresh(world, ['doc'])).toEqual([])
  })

  test('resuming backup does not turn a paused delete into a remote delete', async () => {
    // The user deleted the local copy during a pause. That is not a request to
    // empty the bucket later; withdrawal is a separate, explicit decision.
    const world = createWorld()
    const document = await seedDocument(world, 'doc', TARGET)
    setBackupToCloud(false)
    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    setBackupToCloud(true)
    await world.drain()

    expect(world.harness.adapter.count('delete')).toBe(0)
    expect((await world.store.getMeta('doc'))?.tombstoned).toBe(true)
    expect(await visibleAfterRefresh(world, ['doc'])).toEqual([])
  })

  test('with backup on the delete is pinned to the row’s own destination', async () => {
    const world = createWorld()
    const document = await seedDocument(world, 'doc', TARGET)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    const jobs = await world.outbox.list()
    expect(jobs.map((job) => [job.type, job.targetId])).toEqual([['deleteCanvas', TARGET]])
    const before = await world.store.getMeta('doc')
    expect(before?.tombstoned).toBe(true)
    expect(before?.syncStatus).toBe('pending')
    // Hidden from the moment it is requested, not from the moment it lands.
    expect(await visibleAfterRefresh(world, ['doc'])).toEqual([])

    await world.drain()

    expect(world.harness.adapter.count('delete')).toBe(1)
    expect(world.harness.adapter.bodies.has('doc')).toBe(false)
    expect(await world.outbox.list()).toEqual([])
    expect((await world.store.getMeta('doc'))?.hasFig).toBe(false)
  })

  test('a delete whose job cannot be queued never leaves the row pending', async () => {
    // `pending` claims a durable job exists, and the startup sweep that repairs
    // that claim skips tombstoned rows. A stranded one is unrecoverable.
    const world = createWorld()
    const document = await seedDocument(world, 'doc', TARGET)

    await expect(
      permanentlyDeleteStorageDocument(PROVIDER, document, {
        ...documentDeps(world),
        enqueueDelete: async () => {
          throw new Error('outbox unavailable')
        }
      })
    ).rejects.toThrow('outbox unavailable')

    const meta = await world.store.getMeta('doc')
    expect(meta?.tombstoned).toBe(true)
    expect(meta?.syncStatus).toBe('local')
    expect(await world.outbox.list()).toEqual([])
    expect(await visibleAfterRefresh(world, ['doc'])).toEqual([])
  })
})

describe('disconnect', () => {
  test('locally backed rows keep their bytes and metadata and become local', async () => {
    const world = createWorld()
    await seedDocument(world, 'doc', TARGET)
    const before = await world.store.getMeta('doc')
    expect(before?.syncedBodyId).not.toBeNull()

    const result = await disconnectStorageTarget(TARGET, {
      store: world.store,
      outbox: world.outbox
    })

    expect(result.localizedIds).toEqual(['doc'])
    const meta = await world.store.getMeta('doc')
    expect(meta?.syncTargetId).toBeNull()
    // The confirmation belonged to a bucket this device no longer talks to.
    // Left behind, it tells eviction the only remaining copy is disposable.
    expect(meta?.syncedBodyId).toBeNull()
    expect(meta?.syncStatus).toBe('local')
    expect(meta?.name).toBe(before?.name)
    expect(meta?.hasFig).toBe(true)
    expect(await world.store.readFig('doc')).toEqual(BODY)
  })

  test('index-only rows leave the visible set', async () => {
    const world = createWorld()
    await seedIndexRow(world, 'remote-only', TARGET)

    const result = await disconnectStorageTarget(TARGET, {
      store: world.store,
      outbox: world.outbox
    })

    // Its bytes only ever existed in the bucket, so a row with no destination
    // would be a card that cannot be opened.
    expect(result.removedIds).toEqual(['remote-only'])
    expect(await world.store.getMeta('remote-only')).toBeNull()
    expect(await visibleAfterRefresh(world, [])).toEqual([])
  })

  test('tombstones are retained so reconnecting cannot resurrect a deleted document', async () => {
    const world = createWorld()
    const document = await seedDocument(world, 'doc', TARGET)
    setBackupToCloud(false)
    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()
    setBackupToCloud(true)

    const result = await disconnectStorageTarget(TARGET, {
      store: world.store,
      outbox: world.outbox
    })

    expect(result.retainedTombstoneIds).toEqual(['doc'])
    const meta = await world.store.getMeta('doc')
    expect(meta?.tombstoned).toBe(true)
    // Still scoped to the target it was deleted at: that is what makes it match
    // the same bucket's listing when the user reconnects.
    expect(meta?.syncTargetId).toBe(TARGET)
    expect(await visibleAfterRefresh(world, ['doc'])).toEqual([])
  })

  test('queued uploads for the target are cancelled and queued deletes are not', async () => {
    const world = createWorld()
    const deleted = await seedDocument(world, 'deleted', TARGET)
    // Seeded after the drain above, so its upload is still queued.
    await seedDocument(world, 'queued', TARGET, { upload: false })
    await permanentlyDeleteStorageDocument(PROVIDER, deleted, documentDeps(world))
    await settle()
    expect((await world.outbox.list()).map((job) => job.type).sort()).toEqual([
      'deleteCanvas',
      'putCanvas'
    ])

    const result = await disconnectStorageTarget(TARGET, {
      store: world.store,
      outbox: world.outbox
    })

    expect(result.cancelledJobIds).toHaveLength(1)
    // A delete is a removal the user asked for AT that destination. Dropping it
    // silently leaves the object in the bucket behind a local tombstone that no
    // reconcile will ever clear.
    expect((await world.outbox.list()).map((job) => [job.type, job.targetId])).toEqual([
      ['deleteCanvas', TARGET]
    ])
    expect((await world.store.getMeta('queued'))?.syncStatus).toBe('local')
  })

  test('nothing is removed from the bucket, and other destinations are untouched', async () => {
    const world = createWorld()
    await seedDocument(world, 'doc', TARGET)
    await world.store.upsertIndexMeta({
      id: 'elsewhere',
      syncTargetId: OTHER_TARGET,
      name: 'elsewhere',
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    })

    await disconnectStorageTarget(TARGET, { store: world.store, outbox: world.outbox })
    await world.drain()

    // Disconnect is not withdraw: the remote object stays exactly where it is.
    expect(world.harness.adapter.count('delete')).toBe(0)
    expect(world.harness.adapter.bodies.has('doc')).toBe(true)
    const other = await world.store.getMeta('elsewhere')
    expect(other?.syncTargetId).toBe(OTHER_TARGET)
    expect(other?.syncStatus).toBe('synced')
  })
})
