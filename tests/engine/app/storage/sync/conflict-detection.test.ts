import { describe, expect, test } from 'bun:test'

import type { StorageDocumentMetadata } from '@/app/integrations/storage'
import { computeStateIdentity } from '@/app/storage/identity/state'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'

import { createHarness, recordingAdapter, settle, type RecordingAdapter } from './helpers'

const BODY = new Uint8Array(512).fill(3)
const TARGET_A = 's3-compatible#aaaaaaaa'
const BASE_STATE = 'sha256:base-state'

/** A synced row with an established conflict base. */
async function seedBased(store: LocalCanvasStore, id: string): Promise<number> {
  const meta = await store.writeCanvas({
    id,
    syncTargetId: TARGET_A,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: 'body-1',
    syncedBodyId: 'body-1',
    baseStateId: BASE_STATE
  })
  await store.updateMeta(id, { syncStatus: 'synced' })
  return meta.revision
}

/** The remote sidecar another device would have published. */
async function remoteState(
  adapter: RecordingAdapter,
  id: string,
  input: { name: string; bodyId: string; isTrashed?: boolean }
): Promise<StorageDocumentMetadata> {
  const { stateId } = await computeStateIdentity(input.bodyId, {
    name: input.name,
    sourceFormat: 'fig',
    isTrashed: input.isTrashed ?? false
  })
  const metadata: StorageDocumentMetadata = {
    name: input.name,
    updatedAt: new Date().toISOString(),
    sourceFormat: 'fig',
    trashedAt: input.isTrashed ? new Date().toISOString() : null,
    bodyId: input.bodyId,
    stateId
  }
  adapter.metas.set(id, metadata)
  return metadata
}

/**
 * Preflight conflict detection: the remote's published `stateId` is compared
 * against the row's `baseStateId` before any write. Needs nothing from the
 * provider beyond reading metadata — detection, not prevention.
 */
describe('preflight conflict detection', () => {
  test('a body edit conflicts when another device wrote since our base', async () => {
    const adapter = recordingAdapter()
    const h = createHarness({ adapter })
    const revision = await seedBased(h.store, 'doc-c1')
    // Another device published a different body from the same base.
    await remoteState(adapter, 'doc-c1', { name: 'doc-c1', bodyId: 'body-other' })

    // Our concurrent body edit.
    const edited = await h.store.writeCanvas({
      id: 'doc-c1',
      syncTargetId: TARGET_A,
      name: 'doc-c1',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(640).fill(9),
      bodyId: 'body-2'
    })
    await h.outbox.enqueue({
      canvasId: 'doc-c1',
      type: 'putCanvas',
      revision: edited.revision ?? revision,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()
    await settle()

    // The write STOPPED: nothing of ours reached the remote, and the remote
    // is untouched.
    expect(adapter.count('put')).toBe(0)
    expect(adapter.bodies.has('doc-c1')).toBe(false)
    expect(adapter.metas.get('doc-c1')?.bodyId).toBe('body-other')
    // The row is conflicted and the job parked, not discarded.
    expect((await h.store.getMeta('doc-c1'))?.syncStatus).toBe('conflict')
    const parked = (await h.outbox.list()).find((job) => job.canvasId === 'doc-c1')
    expect(parked?.nextAttemptAt).toBe(Number.MAX_SAFE_INTEGER)
    h.dispose()
  })

  test('rename versus trash across devices conflicts — the class body identity cannot see', async () => {
    const adapter = recordingAdapter()
    const h = createHarness({ adapter })
    await seedBased(h.store, 'doc-c2')
    // Another device trashed the document (same body, different metaId).
    const theirs = await remoteState(adapter, 'doc-c2', {
      name: 'doc-c2',
      bodyId: 'body-1',
      isTrashed: true
    })

    // Our concurrent rename.
    const meta = await h.store.getMeta('doc-c2')
    await h.store.updateMeta('doc-c2', {
      name: 'Renamed',
      revision: (meta?.revision ?? 0) + 1,
      syncStatus: 'pending'
    })
    const renamed = await h.store.getMeta('doc-c2')
    await h.outbox.enqueue({
      canvasId: 'doc-c2',
      type: 'putMetadata',
      revision: renamed?.revision ?? 0,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()
    await settle()

    // Their sidecar is untouched and our rename never reached the key.
    expect(adapter.count('putMetadata')).toBe(0)
    expect(adapter.metas.get('doc-c2')?.trashedAt).toBe(theirs.trashedAt)
    expect((await h.store.getMeta('doc-c2'))?.syncStatus).toBe('conflict')
    h.dispose()
  })

  test('identical concurrent edits converge without a conflict', async () => {
    const adapter = recordingAdapter()
    const h = createHarness({ adapter })
    await seedBased(h.store, 'doc-c3')
    // Another device made the SAME rename we are about to make.
    const theirs = await remoteState(adapter, 'doc-c3', { name: 'Same Name', bodyId: 'body-1' })

    const meta = await h.store.getMeta('doc-c3')
    await h.store.updateMeta('doc-c3', {
      name: 'Same Name',
      revision: (meta?.revision ?? 0) + 1,
      syncStatus: 'pending'
    })
    const renamed = await h.store.getMeta('doc-c3')
    await h.outbox.enqueue({
      canvasId: 'doc-c3',
      type: 'putMetadata',
      revision: renamed?.revision ?? 0,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()
    await settle()

    const after = await h.store.getMeta('doc-c3')
    expect(after?.syncStatus).toBe('synced')
    // Our write published (an identical payload) and the base advanced to the
    // state both devices now agree on.
    expect(after?.baseStateId).toBe(theirs.stateId)
    h.dispose()
  })

  test('a legacy remote without identity never produces a false conflict', async () => {
    const adapter = recordingAdapter()
    const h = createHarness({ adapter })
    await seedBased(h.store, 'doc-c4')
    // Pre-identity sidecar: no stateId at all.
    adapter.metas.set('doc-c4', {
      name: 'Anything',
      updatedAt: new Date().toISOString(),
      sourceFormat: 'fig',
      trashedAt: null
    })

    const meta = await h.store.getMeta('doc-c4')
    await h.store.updateMeta('doc-c4', {
      name: 'Renamed',
      revision: (meta?.revision ?? 0) + 1,
      syncStatus: 'pending'
    })
    const renamed = await h.store.getMeta('doc-c4')
    await h.outbox.enqueue({
      canvasId: 'doc-c4',
      type: 'putMetadata',
      revision: renamed?.revision ?? 0,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()
    await settle()

    const after = await h.store.getMeta('doc-c4')
    expect(after?.syncStatus).not.toBe('conflict')
    expect(after?.syncStatus).toBe('synced')
    // Detection costs one metadata read per write.
    expect(adapter.count('getMetadata')).toBe(1)
    // The written sidecar now carries identity, establishing it remotely.
    expect(adapter.metas.get('doc-c4')?.stateId).toBeTruthy()
    expect(after?.baseStateId).toBe(adapter.metas.get('doc-c4')?.stateId)
    h.dispose()
  })

  test('a row with no recorded base never false-conflicts on first write', async () => {
    const adapter = recordingAdapter()
    const h = createHarness({ adapter })
    // Legacy row: confirmed body but no base state.
    await h.store.writeCanvas({
      id: 'doc-c5',
      syncTargetId: TARGET_A,
      name: 'doc-c5',
      sourceFormat: 'fig',
      figBytes: BODY,
      bodyId: 'body-1',
      syncedBodyId: 'body-1',
      baseStateId: null
    })
    await h.store.updateMeta('doc-c5', { syncStatus: 'synced' })
    await remoteState(adapter, 'doc-c5', { name: 'Someone else', bodyId: 'body-other' })

    const meta = await h.store.getMeta('doc-c5')
    await h.store.updateMeta('doc-c5', {
      name: 'Renamed',
      revision: (meta?.revision ?? 0) + 1,
      syncStatus: 'pending'
    })
    const renamed = await h.store.getMeta('doc-c5')
    await h.outbox.enqueue({
      canvasId: 'doc-c5',
      type: 'putMetadata',
      revision: renamed?.revision ?? 0,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()
    await settle()

    // Unknown base is conservative: the write proceeds and ESTABLISHES the
    // base, rather than crying conflict on every legacy document.
    expect((await h.store.getMeta('doc-c5'))?.syncStatus).toBe('synced')
    expect((await h.store.getMeta('doc-c5'))?.baseStateId).toBeTruthy()
    h.dispose()
  })
})
