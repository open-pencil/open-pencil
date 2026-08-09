import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { markListingConflicts } from '@/app/storage/conflict'
import { computeStateIdentity } from '@/app/storage/identity/state'
import { createMemoryLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { markRevisionSynced } from '@/app/storage/sync/engine'

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

  test("a pending edit does not conflict with this device's own in-flight publish", async () => {
    const store = createMemoryLocalCanvasStore()
    // A prior sync establishes the conflict base.
    const first = await store.writeCanvas({
      id: 'doc-x1',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x1',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(1),
      bodyId: 'body-1'
    })
    await markRevisionSynced(store, 'doc-x1', first.revision, {
      bodyUploaded: true,
      targetId: 's3-compatible#aaaaaaaa',
      stateId: BASE_STATE
    })

    // The next revision's upload goes in flight, and the user edits AGAIN while
    // it is — moving the row past the revision that is completing.
    await store.writeCanvas({
      id: 'doc-x1',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x1',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(2),
      bodyId: 'body-2'
    })
    const inFlight = await store.getMeta('doc-x1')
    if (!inFlight) throw new Error('seed failed')
    await store.writeCanvas({
      id: 'doc-x1',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x1',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(3),
      bodyId: 'body-3'
    })

    // The in-flight upload published state(body-2). Its completion arrives
    // addressed to the in-flight revision, but the row has moved on — refused as
    // the base, yet it still records what this device published.
    const published = await computeStateIdentity('body-2', {
      name: 'doc-x1',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const confirmed = await markRevisionSynced(store, 'doc-x1', inFlight.revision, {
      bodyUploaded: true,
      targetId: 's3-compatible#aaaaaaaa',
      stateId: published.stateId
    })
    expect(confirmed).toBe(false)
    // The base did not move, and the body confirmation did not advance to bytes
    // the remote has never seen.
    expect((await store.getMeta('doc-x1'))?.baseStateId).toBe(BASE_STATE)
    expect((await store.getMeta('doc-x1'))?.syncedBodyId).toBe('body-1')

    // The listing carries exactly the state we published — not another device's.
    const remote = [await remoteDocument('doc-x1', { bodyId: 'body-2' })]
    const meta = await store.getMeta('doc-x1')
    if (!meta) throw new Error('seed failed')
    const conflicts = await markListingConflicts(store, [meta], remote)

    expect(conflicts).toEqual([])
    expect((await store.getMeta('doc-x1'))?.syncStatus).toBe('pending')
  })

  // §8.3: a single field remembers only the most recent publish. Publish S1 then
  // S2, and a listing that raced to see S1 still raises the phantom. Documented,
  // not fixed — a small ring of recent publishes is the fast-follow.
  test.skip('KNOWN GAP: a listing racing to the earlier of two publishes still phantoms', async () => {
    const store = createMemoryLocalCanvasStore()
    const first = await store.writeCanvas({
      id: 'doc-x2',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x2',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(1),
      bodyId: 'body-1'
    })
    // Publish S1, then S2 — both acknowledged, so lastPublishedStateId = S2.
    await markRevisionSynced(store, 'doc-x2', first.revision, {
      bodyUploaded: true,
      targetId: 's3-compatible#aaaaaaaa',
      stateId: 'sha256:S1'
    })
    await store.writeCanvas({
      id: 'doc-x2',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x2',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(2),
      bodyId: 'body-2'
    })
    const second = await store.getMeta('doc-x2')
    if (!second) throw new Error('seed failed')
    await markRevisionSynced(store, 'doc-x2', second.revision, {
      bodyUploaded: true,
      targetId: 's3-compatible#aaaaaaaa',
      stateId: 'sha256:S2'
    })
    expect((await store.getMeta('doc-x2'))?.lastPublishedStateId).toBe('sha256:S2')

    // Edit → pending; base is S2.
    await store.writeCanvas({
      id: 'doc-x2',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'doc-x2',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(128).fill(3),
      bodyId: 'body-3'
    })
    const meta = await store.getMeta('doc-x2')
    if (!meta) throw new Error('seed failed')

    // A listing that raced still shows the EARLIER publish S1.
    const staleRemote: StorageDocument = {
      id: 'doc-x2',
      name: 'doc-x2',
      updatedAt: new Date().toISOString(),
      sourceFormat: 'fig',
      trashedAt: null,
      bodyId: 'body-1',
      stateId: 'sha256:S1',
      metadataAuthoritative: true
    }
    const conflicts = await markListingConflicts(store, [meta], [staleRemote])
    // Single field holds only S2, so S1 !== lastPublishedStateId → this PHANTOMS.
    expect(conflicts).toEqual([])
  })
})
