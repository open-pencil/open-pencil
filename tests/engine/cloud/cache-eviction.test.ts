import { beforeEach, describe, expect, test } from 'bun:test'

import { evictLocalFigCache } from '@/app/cloud/cache-eviction'
import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/cloud/local-store'
import type { LocalSyncStatus } from '@/app/cloud/local-store'

const MB = 1024 * 1024

async function seed(
  id: string,
  sizeMb: number,
  lastOpenedAt: string,
  syncStatus: LocalSyncStatus = 'synced'
) {
  const local = getLocalCanvasStore()
  await local.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    figBytes: new Uint8Array(sizeMb * MB),
    syncStatus
  })
  await local.updateMeta(id, { lastOpenedAt })
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
})
