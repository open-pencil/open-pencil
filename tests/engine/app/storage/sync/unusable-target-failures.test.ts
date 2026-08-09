import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { createMemoryOutbox, type Outbox } from '@/app/storage/sync/outbox'
import { clearUnusableTargetFailures } from '@/app/storage/sync/repair'
import type { StorageTargetID } from '@/app/storage/target'

const BODY = new Uint8Array(128).fill(7)
const TARGET_A = 's3-compatible#aaaaaaaa' as StorageTargetID
const TARGET_B = 's3-compatible#bbbbbbbb' as StorageTargetID

type Fixture = {
  store: LocalCanvasStore
  outbox: Outbox
  sweep: (usable: (targetId: StorageTargetID) => Promise<boolean>) => Promise<number>
}

function fixture(): Fixture {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  return {
    store,
    outbox,
    sweep: (usable) =>
      clearUnusableTargetFailures({
        getStore: () => store,
        getOutbox: () => outbox,
        targetUsable: usable
      })
  }
}

/** A row marked failed by a job that could not reach its destination. */
async function seedFailedRow(
  store: LocalCanvasStore,
  id: string,
  syncTargetId: StorageTargetID,
  error = 'Storage credentials are unavailable'
): Promise<void> {
  await store.writeCanvas({
    id,
    syncTargetId,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: `${id}-body`,
    syncStatus: 'pending'
  })
  await store.updateMeta(id, {
    syncStatus: 'error',
    lastSyncError: error,
    lastThumbSyncError: error
  })
}

/**
 * The badge this sweep retires: a document marked "Sync failed" / "Preview
 * not synced" by a destination that cannot even be attempted, while the
 * workspace footer reads "No cloud configured · Local storage only". Older
 * builds recorded the block itself as a per-document failure, and nothing
 * cleared it while the destination stayed unusable.
 */
describe('clearing failure marks a destination could not have produced', () => {
  test('an error row with a parked job becomes honestly pending again', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-a', TARGET_A)
    await f.outbox.enqueue({
      canvasId: 'doc-a',
      type: 'putCanvas',
      revision: 1,
      targetId: TARGET_A
    })

    const released = await f.sweep(async () => false)

    const meta = await f.store.getMeta('doc-a')
    // A durable job still owes the destination these bytes — parked counts,
    // because resume() revives it once settings are repaired.
    expect(meta?.syncStatus).toBe('pending')
    expect(meta?.lastSyncError).toBeNull()
    expect(meta?.lastThumbSyncError).toBeNull()
    expect(released).toBe(1)
  })

  test('an error row with outstanding bytes and no job settles as local', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-b', TARGET_A)

    const released = await f.sweep(async () => false)

    // Same outcome a save produces while the destination is unusable:
    // committed here, no upload intended right now.
    expect((await f.store.getMeta('doc-b'))?.syncStatus).toBe('local')
    expect(released).toBe(1)
  })

  test('an error row with nothing left to send settles as synced', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-c', TARGET_A)
    await f.store.updateMeta('doc-c', { syncedBodyId: 'doc-c-body' })

    await f.sweep(async () => false)

    expect((await f.store.getMeta('doc-c'))?.syncStatus).toBe('synced')
  })

  test('a stale preview failure lifts without disturbing the body status', async () => {
    const f = fixture()
    await f.store.writeCanvas({
      id: 'doc-d',
      syncTargetId: TARGET_A,
      name: 'doc-d',
      sourceFormat: 'fig',
      figBytes: BODY,
      bodyId: 'doc-d-body',
      syncedBodyId: 'doc-d-body',
      syncStatus: 'synced'
    })
    await f.store.updateMeta('doc-d', {
      lastThumbSyncError: 'Storage credentials are unavailable'
    })

    const released = await f.sweep(async () => false)

    const meta = await f.store.getMeta('doc-d')
    expect(meta?.syncStatus).toBe('synced')
    expect(meta?.lastThumbSyncError).toBeNull()
    expect(released).toBe(1)
  })

  test('failures recorded against a usable destination are left alone', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-e', TARGET_A, 'HTTP 403')

    const released = await f.sweep(async () => true)

    // The sweep lifts noise; it does not launder real faults.
    const meta = await f.store.getMeta('doc-e')
    expect(meta?.syncStatus).toBe('error')
    expect(meta?.lastSyncError).toBe('HTTP 403')
    expect(released).toBe(0)
  })

  test('usability is judged per target, not per provider', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-f', TARGET_A)
    await seedFailedRow(f.store, 'doc-g', TARGET_B)

    const released = await f.sweep(async (targetId) => targetId === TARGET_B)

    expect((await f.store.getMeta('doc-f'))?.syncStatus).toBe('local')
    expect((await f.store.getMeta('doc-g'))?.syncStatus).toBe('error')
    expect(released).toBe(1)
  })

  test('running twice changes nothing', async () => {
    const f = fixture()
    await seedFailedRow(f.store, 'doc-h', TARGET_A)

    const first = await f.sweep(async () => false)
    const metasAfterFirst = await f.store.listMetas()
    const second = await f.sweep(async () => false)

    expect(first).toBe(1)
    expect(second).toBe(0)
    expect(await f.store.listMetas()).toEqual(metasAfterFirst)
  })
})
