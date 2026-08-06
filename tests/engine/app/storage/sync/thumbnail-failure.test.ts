import { beforeEach, describe, expect, test } from 'bun:test'

import { setSyncUi, syncUiState } from '@/app/storage/sync/status'

import { createHarness, faultyAdapter, seedSyncedDocument } from './helpers'

const BODY = new Uint8Array(512).fill(3)
const THUMB = new Uint8Array(64).fill(9)

/**
 * A stale preview is cosmetic. The document behind it is intact, and saying
 * otherwise is worse than saying nothing: it sends the user hunting for data
 * loss that never happened, and it destroys whatever real error was recorded.
 */
describe('thumbnail sync failures stay separate from document failures', () => {
  beforeEach(() => {
    // `syncUiState` is a module singleton shared by every test in the process.
    setSyncUi('idle')
  })

  test('a permanent putThumb failure writes only the thumbnail error field', async () => {
    const h = createHarness({ adapter: faultyAdapter({ thumbStatus: 403 }) })
    await seedSyncedDocument(h.store, 'doc-thumb-1', BODY)
    await h.store.writeThumb('doc-thumb-1', THUMB)

    const seeded = await h.store.getMeta('doc-thumb-1')
    await h.engine.enqueuePutThumb('doc-thumb-1', seeded?.revision ?? 0)
    await h.drainWakes()

    const after = await h.store.getMeta('doc-thumb-1')
    expect(after?.lastThumbSyncError).toContain('403')
    // The two assertions that matter: the document is not reported as broken,
    // and its own error slot was not overwritten by the cosmetic one.
    expect(after?.lastSyncError).toBeNull()
    expect(after?.syncStatus).not.toBe('error')
    h.dispose()
  })

  test('a putThumb failure never overwrites a recorded document error', async () => {
    const h = createHarness({ adapter: faultyAdapter({ thumbStatus: 403 }) })
    await seedSyncedDocument(h.store, 'doc-thumb-2', BODY)
    await h.store.writeThumb('doc-thumb-2', THUMB)
    await h.store.updateMeta('doc-thumb-2', {
      syncStatus: 'error',
      lastSyncError: 'missing scopes (["buckets.write"])'
    })

    const seeded = await h.store.getMeta('doc-thumb-2')
    await h.engine.enqueuePutThumb('doc-thumb-2', seeded?.revision ?? 0)
    await h.drainWakes()

    const after = await h.store.getMeta('doc-thumb-2')
    expect(after?.lastSyncError).toBe('missing scopes (["buckets.write"])')
    expect(after?.lastThumbSyncError).toContain('403')
    h.dispose()
  })

  test('a retrying putThumb failure does not raise the global failure state', async () => {
    const h = createHarness({ adapter: faultyAdapter({ thumbStatus: 503 }) })
    await seedSyncedDocument(h.store, 'doc-thumb-3', BODY)
    await h.store.writeThumb('doc-thumb-3', THUMB)

    const seeded = await h.store.getMeta('doc-thumb-3')
    await h.engine.enqueuePutThumb('doc-thumb-3', seeded?.revision ?? 0)
    await h.drainWakes(3)

    const after = await h.store.getMeta('doc-thumb-3')
    expect(after?.lastThumbSyncError).toContain('503')
    expect(after?.syncStatus).not.toBe('pending')
    // No failure snapshot is captured for putThumb, so a red chip here would
    // open a detail view with nothing behind it.
    expect(syncUiState.value).not.toBe('error')
    h.dispose()
  })

  test('a successful putThumb clears a previously recorded thumbnail error', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-thumb-4', BODY)
    await h.store.writeThumb('doc-thumb-4', THUMB)
    await h.store.updateMeta('doc-thumb-4', { lastThumbSyncError: 'HTTP 503' })

    const seeded = await h.store.getMeta('doc-thumb-4')
    await h.engine.enqueuePutThumb('doc-thumb-4', seeded?.revision ?? 0)
    await h.drainWakes()

    const after = await h.store.getMeta('doc-thumb-4')
    expect(h.adapter.count('putThumb')).toBe(1)
    expect(after?.lastThumbSyncError).toBeNull()
    h.dispose()
  })
})
