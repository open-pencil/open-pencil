import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { markListingConflicts } from '@/app/storage/conflict'
import { computeStateIdentity } from '@/app/storage/identity/state'
import { createMemoryLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'

const BASE_STATE = 'sha256:base-state'

async function seedRow(
  store: ReturnType<typeof createMemoryLocalCanvasStore>,
  id: string,
  options: { status: LocalCanvasMeta['syncStatus']; baseStateId?: string | null }
): Promise<LocalCanvasMeta> {
  await store.writeCanvas({
    id,
    syncTargetId: 's3-compatible#aaaaaaaa',
    name: id,
    sourceFormat: 'fig',
    figBytes: new Uint8Array(128).fill(1),
    bodyId: 'body-1',
    syncedBodyId: 'body-1',
    baseStateId: options.baseStateId ?? BASE_STATE
  })
  await store.updateMeta(id, { syncStatus: options.status })
  const meta = await store.getMeta(id)
  if (!meta) throw new Error('seed failed')
  return meta
}

async function remoteDocument(
  id: string,
  input: { name?: string; isTrashed?: boolean; bodyId?: string }
): Promise<StorageDocument> {
  const { stateId } = await computeStateIdentity(input.bodyId ?? 'body-1', {
    name: input.name ?? id,
    sourceFormat: 'fig',
    isTrashed: input.isTrashed ?? false
  })
  return {
    id,
    name: input.name ?? id,
    updatedAt: new Date().toISOString(),
    sourceFormat: 'fig',
    trashedAt: input.isTrashed ? new Date().toISOString() : null,
    bodyId: input.bodyId ?? 'body-1',
    stateId,
    metadataAuthoritative: true
  }
}

/**
 * The workspace listing reads every sidecar already, so conflict detection
 * there is free — and it fires before the user opens the document, not after
 * the drain would have overwritten the other device's work.
 */
describe('listing-time conflict detection', () => {
  test('a pending row is marked when the remote moved from its base', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await seedRow(store, 'doc-l1', { status: 'pending' })
    const remote = [await remoteDocument('doc-l1', { bodyId: 'body-other' })]

    const conflicts = await markListingConflicts(store, [meta], remote)

    expect(conflicts).toEqual(['doc-l1'])
    expect((await store.getMeta('doc-l1'))?.syncStatus).toBe('conflict')
  })

  test('a pending row converges when the remote holds exactly what we would publish', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await seedRow(store, 'doc-l2', { status: 'pending' })
    // Another device made the same rename our pending edit made.
    await store.updateMeta('doc-l2', { name: 'Same Name' })
    const renamed = await store.getMeta('doc-l2')
    const remote = [await remoteDocument('doc-l2', { name: 'Same Name' })]

    const conflicts = await markListingConflicts(store, [renamed ?? meta], remote)

    expect(conflicts).toEqual([])
    expect((await store.getMeta('doc-l2'))?.syncStatus).toBe('pending')
  })

  test('a clean row is never marked — remote movement alone is a newer version, not a conflict', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await seedRow(store, 'doc-l3', { status: 'synced' })
    const remote = [await remoteDocument('doc-l3', { bodyId: 'body-other' })]

    const conflicts = await markListingConflicts(store, [meta], remote)

    expect(conflicts).toEqual([])
    expect((await store.getMeta('doc-l3'))?.syncStatus).toBe('synced')
  })

  test('rows without a recorded base or without remote identity are left alone', async () => {
    const store = createMemoryLocalCanvasStore()
    const noBase = await seedRow(store, 'doc-l4', { status: 'pending', baseStateId: null })
    const remoteNoIdentity: StorageDocument = {
      id: 'doc-l4',
      name: 'Anything',
      updatedAt: new Date().toISOString(),
      sourceFormat: 'fig',
      trashedAt: null,
      metadataAuthoritative: true
    }

    const conflicts = await markListingConflicts(store, [noBase], [remoteNoIdentity])

    expect(conflicts).toEqual([])
    expect((await store.getMeta('doc-l4'))?.syncStatus).toBe('pending')
  })
})
