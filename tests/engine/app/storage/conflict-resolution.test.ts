import { describe, expect, test } from 'bun:test'

import { resolveStorageConflict } from '@/app/storage/conflict'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { createMemoryOutbox } from '@/app/storage/sync/outbox'

import { recordingAdapter } from './sync/harness'

const BODY = new Uint8Array(512).fill(3)
const TARGET_A = 's3-compatible#aaaaaaaa'

async function seedConflicted(store: ReturnType<typeof createMemoryLocalCanvasStore>, id: string) {
  await store.writeCanvas({
    id,
    syncTargetId: TARGET_A,
    name: 'My Document',
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: 'body-local',
    syncedBodyId: 'body-1',
    baseStateId: 'sha256:base'
  })
  await store.updateMeta(id, { syncStatus: 'conflict', revision: 7 })
}

function remoteSidecar(adapter: ReturnType<typeof recordingAdapter>, id: string) {
  adapter.metas.set(id, {
    name: 'Their Document',
    updatedAt: '2026-08-04T12:00:00.000Z',
    sourceFormat: 'fig',
    trashedAt: null,
    bodyId: 'body-remote',
    stateId: 'sha256:remote-state'
  })
}

function depsFor(
  store: ReturnType<typeof createMemoryLocalCanvasStore>,
  outbox: ReturnType<typeof createMemoryOutbox>,
  adapter: ReturnType<typeof recordingAdapter>
) {
  const enqueued: string[] = []
  return {
    enqueued,
    deps: {
      store,
      outbox,
      adapter,
      enqueueCanvas: async (id: string) => {
        enqueued.push(id)
      },
      createId: () => 'copy-1'
    }
  }
}

/**
 * Resolution never overwrites: the remote stays as the other device wrote it,
 * the local divergence survives as its own document, and the original
 * fast-forwards to the remote state.
 */
describe('conflict resolution', () => {
  test('keep-local-copy preserves local bytes as a new document and fast-forwards the original', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const adapter = recordingAdapter()
    await seedConflicted(store, 'doc-r1')
    remoteSidecar(adapter, 'doc-r1')
    await outbox.enqueue({ canvasId: 'doc-r1', type: 'putCanvas', revision: 7, targetId: TARGET_A })
    const { enqueued, deps } = depsFor(store, outbox, adapter)

    const result = await resolveStorageConflict('doc-r1', 'keep-local-copy', deps)

    expect(result.copyId).toBe('copy-1')
    // The copy carries the local bytes and owes the remote an upload.
    const copy = await store.getMeta('copy-1')
    expect(copy?.name).toBe('My Document (my changes)')
    expect(copy?.syncTargetId).toBe(TARGET_A)
    expect(copy?.syncStatus).toBe('pending')
    expect(enqueued).toEqual(['copy-1'])
    expect([...((await store.readFig('copy-1')) ?? [])]).toEqual([...BODY])

    // The original follows the remote: state, identity, and base all adopted;
    // its own bytes reclaimed (they live on in the copy).
    const original = await store.getMeta('doc-r1')
    expect(original?.syncStatus).toBe('synced')
    expect(original?.name).toBe('Their Document')
    expect(original?.bodyId).toBe('body-remote')
    expect(original?.syncedBodyId).toBe('body-remote')
    expect(original?.baseStateId).toBe('sha256:remote-state')
    expect(original?.hasFig).toBe(false)

    // The parked conflict job is settled — nothing may retry it.
    expect(await outbox.list()).toEqual([])
    // The remote was never written.
    expect(adapter.count('put')).toBe(0)
    expect(adapter.count('putMetadata')).toBe(0)
  })

  test('load-remote keeps the same safety copy under a backup name', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const adapter = recordingAdapter()
    await seedConflicted(store, 'doc-r2')
    remoteSidecar(adapter, 'doc-r2')
    const { deps } = depsFor(store, outbox, adapter)

    const result = await resolveStorageConflict('doc-r2', 'load-remote', deps)

    expect(result.copyId).toBe('copy-1')
    expect((await store.getMeta('copy-1'))?.name).toBe('My Document (local backup)')
    expect((await store.getMeta('doc-r2'))?.syncStatus).toBe('synced')
  })

  test('a conflicted row without local bytes fast-forwards without a copy', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const adapter = recordingAdapter()
    await seedConflicted(store, 'doc-r3')
    await store.clearFig('doc-r3')
    remoteSidecar(adapter, 'doc-r3')
    const { enqueued, deps } = depsFor(store, outbox, adapter)

    const result = await resolveStorageConflict('doc-r3', 'load-remote', deps)

    expect(result.copyId).toBeNull()
    expect(enqueued).toEqual([])
    expect((await store.getMeta('doc-r3'))?.syncStatus).toBe('synced')
  })

  test('an unreadable remote leaves the row conflicted and untouched', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const adapter = recordingAdapter()
    await seedConflicted(store, 'doc-r4')
    // No remote sidecar — getDocumentMetadata returns null.
    await outbox.enqueue({ canvasId: 'doc-r4', type: 'putCanvas', revision: 7, targetId: TARGET_A })
    const { deps } = depsFor(store, outbox, adapter)

    await expect(resolveStorageConflict('doc-r4', 'load-remote', deps)).rejects.toThrow(
      /remote version could not be read/i
    )

    expect((await store.getMeta('doc-r4'))?.syncStatus).toBe('conflict')
    expect((await store.readFig('doc-r4'))?.byteLength).toBe(BODY.byteLength)
    expect((await outbox.list()).length).toBe(1)
  })

  test('resolving a non-conflicted row is a no-op', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const adapter = recordingAdapter()
    await store.writeCanvas({
      id: 'doc-r5',
      syncTargetId: TARGET_A,
      name: 'Calm',
      sourceFormat: 'fig',
      figBytes: BODY,
      bodyId: 'body-1',
      syncedBodyId: 'body-1'
    })
    await store.updateMeta('doc-r5', { syncStatus: 'synced' })
    const { deps } = depsFor(store, outbox, adapter)

    const result = await resolveStorageConflict('doc-r5', 'load-remote', deps)

    expect(result.copyId).toBeNull()
    expect((await store.getMeta('doc-r5'))?.syncStatus).toBe('synced')
    expect((await store.getMeta('doc-r5'))?.hasFig).toBe(true)
  })
})
