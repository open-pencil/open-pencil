import { beforeEach, describe, expect, test } from 'bun:test'

import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import type { LocalSyncStatus } from '@/app/storage/local-store'

const MB = 1024 * 1024

/**
 * Seed a row whose bytes are genuinely on the remote: `syncStatus: 'synced'`
 * AND a confirmed body upload at the current revision. Both are required for
 * eviction — `syncStatus` alone can be set by a metadata-only put, which would
 * make eviction destroy the only copy.
 */
async function seed(
  id: string,
  sizeMb: number,
  lastOpenedAt: string,
  syncStatus: LocalSyncStatus = 'synced'
) {
  const local = getLocalCanvasStore()
  const meta = await local.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    figBytes: new Uint8Array(sizeMb * MB),
    bodyId: `sha256:${id}`,
    syncStatus
  })
  await local.updateMeta(id, {
    lastOpenedAt,
    ...(syncStatus === 'synced' ? { syncedBodyId: meta.bodyId } : {})
  })
}

describe('evictLocalFigCache', () => {
  beforeEach(() => {
    resetLocalCanvasStoreForTests(createMemoryLocalCanvasStore())
  })

  test('does nothing under budget', async () => {
    await seed('a', 2, '2026-01-01')
    const evicted = await evictLocalFigCache(new Set(), 10 * MB)
    expect(evicted).toBe(0)
  })

  test('evicts least-recently-opened synced figs until under budget', async () => {
    await seed('old', 4, '2026-01-01')
    await seed('mid', 4, '2026-02-01')
    await seed('new', 4, '2026-03-01')
    const evicted = await evictLocalFigCache(new Set(), 8 * MB)
    expect(evicted).toBe(1)
    const local = getLocalCanvasStore()
    const oldMeta = await local.getMeta('old')
    expect(oldMeta?.hasFig).toBe(false)
    expect(await local.readFig('old')).toBeNull()
    // meta row and identity survive — the card stays listed
    expect(oldMeta?.name).toBe('old')
    expect((await local.getMeta('new'))?.hasFig).toBe(true)
  })

  test('never evicts unsynced or open canvases', async () => {
    await seed('dirty', 4, '2026-01-01', 'pending')
    await seed('open', 4, '2026-01-02')
    await seed('fresh', 4, '2026-03-01')
    const evicted = await evictLocalFigCache(new Set(['open']), 4 * MB)
    const local = getLocalCanvasStore()
    expect((await local.getMeta('dirty'))?.hasFig).toBe(true)
    expect((await local.getMeta('open'))?.hasFig).toBe(true)
    // only 'fresh' was evictable
    expect(evicted).toBe(1)
    expect((await local.getMeta('fresh'))?.hasFig).toBe(false)
  })

  test('backfills figSize for legacy rows instead of skipping them', async () => {
    await seed('legacy', 6, '2026-01-01')
    const local = getLocalCanvasStore()
    await local.updateMeta('legacy', { figSize: undefined })
    const evicted = await evictLocalFigCache(new Set(), 1 * MB)
    expect(evicted).toBe(1)
  })

  test('keeps bytes when synced but no body upload was ever confirmed', async () => {
    // A metadata-only put (rename/trash) can mark a row 'synced' without any
    // body reaching the remote. Evicting here destroys the only copy.
    await seed('sidecar-only', 6, '2026-01-01')
    const local = getLocalCanvasStore()
    await local.updateMeta('sidecar-only', { syncedBodyId: null })

    const evicted = await evictLocalFigCache(new Set(), 1 * MB)

    expect(evicted).toBe(0)
    expect((await local.getMeta('sidecar-only'))?.hasFig).toBe(true)
    expect(await local.readFig('sidecar-only')).not.toBeNull()
  })

  test('keeps bytes when the local body has changed since the last upload', async () => {
    // Body confirmed, then the user edited again — the new bytes exist only here.
    await seed('stale-body', 6, '2026-01-01')
    const local = getLocalCanvasStore()
    await local.updateMeta('stale-body', { bodyId: 'sha256:stale-body-edited' })

    const evicted = await evictLocalFigCache(new Set(), 1 * MB)

    expect(evicted).toBe(0)
    expect(await local.readFig('stale-body')).not.toBeNull()
  })

  test('still evicts after a rename, which changes no bytes', async () => {
    // The counterpart: `revision` advancing is not evidence the body differs.
    // Comparing revisions kept renamed documents pinned in the cache forever.
    await seed('renamed', 6, '2026-01-01')
    const local = getLocalCanvasStore()
    const before = await local.getMeta('renamed')
    await local.updateMeta('renamed', {
      name: 'Renamed',
      revision: (before?.revision ?? 1) + 1
    })

    const evicted = await evictLocalFigCache(new Set(), 1 * MB)

    expect(evicted).toBe(1)
  })
})

describe('lastOpenedAt is written by the product', () => {
  /**
   * The eviction tests used to set `lastOpenedAt` themselves, so six passing
   * tests validated an ordering the product could not produce: nothing wrote
   * the field, and `buildIndexMeta` dropped it on every reconcile. The LRU was
   * really least-recently-WRITTEN.
   */
  test('survives an index-only reconcile', async () => {
    const local = getLocalCanvasStore()
    await local.writeCanvas({
      id: 'kept',
      providerId: 's3-compatible',
      name: 'kept',
      figBytes: new Uint8Array([1]),
      bodyId: 'sha256:kept'
    })
    await local.updateMeta('kept', { lastOpenedAt: '2026-05-05T00:00:00.000Z' })

    // A remote listing re-upserts the row; the LRU key must not be erased.
    await local.upsertIndexMeta({
      id: 'kept',
      providerId: 's3-compatible',
      name: 'kept',
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    })

    expect((await local.getMeta('kept'))?.lastOpenedAt).toBe('2026-05-05T00:00:00.000Z')
  })

  test('falls back to a write timestamp when a document was never opened', async () => {
    // Ordering must stay total: a never-opened document still needs a position.
    await seed('never-opened', 6, '2026-01-01')
    const local = getLocalCanvasStore()
    await local.updateMeta('never-opened', { lastOpenedAt: undefined })

    const evicted = await evictLocalFigCache(new Set(), 1 * MB)

    expect(evicted).toBe(1)
  })
})
