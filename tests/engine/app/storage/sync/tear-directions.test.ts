import { describe, expect, test } from 'bun:test'

import type { StorageAdapter } from '@/app/integrations/storage'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'

import {
  createHarness,
  FakeHttpError,
  recordingAdapter,
  settle,
  type RecordingAdapter
} from './helpers'

const BODY = new Uint8Array(512).fill(3)
const TARGET_A = 's3-compatible#aaaaaaaa'

/** A row whose body has never reached the remote. */
async function seedUnconfirmed(store: LocalCanvasStore, id: string): Promise<number> {
  const meta = await store.writeCanvas({
    id,
    syncTargetId: TARGET_A,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: 'body-1'
  })
  await store.updateMeta(id, { syncStatus: 'pending', syncedBodyId: null })
  return meta.revision
}

/** Rename the way `rewriteStorageDocument` does: explicit revision bump. */
async function rename(store: LocalCanvasStore, id: string, name: string): Promise<number> {
  const meta = await store.getMeta(id)
  const revision = (meta?.revision ?? 0) + 1
  await store.updateMeta(id, { name, revision, syncStatus: 'pending' })
  return revision
}

/** A live clock with a manual offset — jobs enqueued in real time stay due. */
function offsetClock(): { now(): number; advance(ms: number): void } {
  let offset = 0
  return {
    now: () => Date.now() + offset,
    advance: (ms) => {
      offset += ms
    }
  }
}

/** A `putDocument` that fails once with a transient 503, then delegates. */
function failFirstPut(inner: RecordingAdapter): RecordingAdapter {
  let failed = false
  return {
    ...inner,
    calls: inner.calls,
    bodies: inner.bodies,
    metas: inner.metas,
    count: inner.count,
    putDocument: async (id, bytes, onProgress) => {
      // Record the attempt before failing — the count is the only evidence of it.
      if (!failed) {
        failed = true
        inner.calls.push({ op: 'put', id, byteLength: bytes.byteLength })
        throw new FakeHttpError(503)
      }
      return inner.putDocument(id, bytes, onProgress)
    }
  }
}

/** A `putDocumentMetadata` that fails once with a transient 503, then delegates. */
function failFirstMetadataPut(inner: RecordingAdapter): RecordingAdapter {
  let failed = false
  return {
    ...inner,
    calls: inner.calls,
    bodies: inner.bodies,
    metas: inner.metas,
    count: inner.count,
    putDocumentMetadata: async (id, metadata) => {
      if (!failed) {
        failed = true
        throw new FakeHttpError(503)
      }
      return inner.putDocumentMetadata(id, metadata)
    }
  }
}

/** A `putDocument` that blocks until released — a multi-second upload stand-in. */
function gatedPut(inner: RecordingAdapter) {
  let release: () => void = () => undefined
  let signalStart: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const started = new Promise<void>((resolve) => {
    signalStart = resolve
  })
  const adapter: StorageAdapter = {
    ...inner,
    putDocument: async (id, bytes, onProgress) => {
      signalStart()
      await gate
      return inner.putDocument(id, bytes, onProgress)
    }
  }
  return { adapter, started, release }
}

/**
 * Queue-level tear directions. A single `putDocument` writes body before
 * sidecar, but the QUEUE selects the first due job regardless of type — the
 * defect class the cloud-sync assessment (C3 / Round 4) proved reachable.
 * These tests pin both directions with the body job in backoff.
 */
describe('remote tear directions', () => {
  test('metadata job due during body backoff: tear stays invisible, then converges', async () => {
    const inner = recordingAdapter()
    const adapter = failFirstPut(inner)
    const clock = offsetClock()
    const h = createHarness({ adapter, now: clock.now })
    const revision = await seedUnconfirmed(h.store, 'doc-t1')

    // Body upload fails into backoff (nextAttemptAt = now + 1500ms).
    await h.outbox.enqueue({ canvasId: 'doc-t1', type: 'putCanvas', revision, targetId: TARGET_A })
    await h.engine.pumpOnce()
    expect(inner.count('put')).toBe(1)
    expect(inner.bodies.has('doc-t1')).toBe(false)

    // A rename lands while the body job is in backoff; its job is due now.
    const renamed = await rename(h.store, 'doc-t1', 'Renamed')
    await h.outbox.enqueue({
      canvasId: 'doc-t1',
      type: 'putMetadata',
      revision: renamed,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()

    // Mid-state: the sidecar reached the remote but no body has. A listing
    // derives ids from body keys, so the document is INVISIBLE — no second
    // device can edit from this tear.
    expect(inner.metas.get('doc-t1')?.name).toBe('Renamed')
    expect(inner.bodies.has('doc-t1')).toBe(false)
    expect((await adapter.listDocuments()).map((doc) => doc.id)).not.toContain('doc-t1')
    expect((await h.store.getMeta('doc-t1'))?.syncStatus).toBe('pending')

    // The metadata put repairs after itself: a fresh body job is queued, the
    // backoff elapses, and the body lands. The completion write re-reads the
    // row, so the sidecar payload is the renamed one again — never the old name.
    clock.advance(2000)
    await h.engine.pumpOnce()
    await settle()

    expect(inner.bodies.has('doc-t1')).toBe(true)
    const listing = await adapter.listDocuments()
    const listed = listing.find((doc) => doc.id === 'doc-t1')
    expect(listed?.name).toBe('Renamed')
    expect(listed?.metadataAuthoritative).toBe(true)
    const sidecarPayloads = inner.calls
      .filter((call) => call.op === 'putMetadata' && call.id === 'doc-t1')
      .map((call) => call.metadata?.name)
    expect(sidecarPayloads.length).toBeGreaterThanOrEqual(2)
    expect(new Set(sidecarPayloads)).toEqual(new Set(['Renamed']))
    expect((await h.store.getMeta('doc-t1'))?.syncStatus).toBe('synced')
    h.dispose()
  })

  test('body lands but the sidecar write fails: listed non-authoritative, then converges', async () => {
    const inner = recordingAdapter()
    const adapter = failFirstMetadataPut(inner)
    const clock = offsetClock()
    const h = createHarness({ adapter, now: clock.now })
    const revision = await seedUnconfirmed(h.store, 'doc-t2')

    await h.outbox.enqueue({ canvasId: 'doc-t2', type: 'putCanvas', revision, targetId: TARGET_A })
    await h.engine.pumpOnce()

    // The bounded tear direction: new bytes, no metadata. The document lists —
    // the body key exists — but with non-authoritative metadata, so reconcile
    // refuses to let this row win over local state.
    expect(inner.bodies.has('doc-t2')).toBe(true)
    expect(inner.metas.has('doc-t2')).toBe(false)
    const torn = (await adapter.listDocuments()).find((doc) => doc.id === 'doc-t2')
    expect(torn?.metadataAuthoritative).toBe(false)
    expect((await h.store.getMeta('doc-t2'))?.syncStatus).not.toBe('synced')

    clock.advance(2000)
    await h.engine.pumpOnce()
    await settle()

    const healed = (await adapter.listDocuments()).find((doc) => doc.id === 'doc-t2')
    expect(healed?.metadataAuthoritative).toBe(true)
    expect((await h.store.getMeta('doc-t2'))?.syncStatus).toBe('synced')
    h.dispose()
  })

  test('metadata-first on a never-uploaded document stays unlisted until the body lands', async () => {
    const inner = recordingAdapter()
    const clock = offsetClock()
    const h = createHarness({ adapter: inner, now: clock.now })
    const revision = await seedUnconfirmed(h.store, 'doc-t3')

    // Only a metadata job — the engine must notice the body is unconfirmed and
    // repair it rather than leaving a sidecar with nothing behind it.
    await h.outbox.enqueue({
      canvasId: 'doc-t3',
      type: 'putMetadata',
      revision,
      targetId: TARGET_A
    })
    await h.engine.pumpOnce()

    expect(inner.metas.has('doc-t3')).toBe(true)
    expect(inner.bodies.has('doc-t3')).toBe(false)
    expect((await inner.listDocuments()).map((doc) => doc.id)).not.toContain('doc-t3')

    // The repair body job was enqueued by the metadata put itself.
    const repair = (await h.outbox.list()).find(
      (job) => job.canvasId === 'doc-t3' && job.type === 'putCanvas'
    )
    expect(repair).toBeDefined()

    await h.engine.pumpOnce()
    await settle()

    expect(inner.bodies.has('doc-t3')).toBe(true)
    const listed = (await inner.listDocuments()).find((doc) => doc.id === 'doc-t3')
    expect(listed?.metadataAuthoritative).toBe(true)
    expect((await h.store.getMeta('doc-t3'))?.syncStatus).toBe('synced')
    h.dispose()
  })

  test('a rename during a slow upload never writes the old name remotely', async () => {
    const inner = recordingAdapter()
    const gated = gatedPut(inner)
    const clock = offsetClock()
    const h = createHarness({ adapter: gated.adapter, now: clock.now })

    // A confirmed document, then a body edit that must upload.
    await h.store.writeCanvas({
      id: 'doc-t4',
      syncTargetId: TARGET_A,
      name: 'Original',
      sourceFormat: 'fig',
      figBytes: BODY,
      bodyId: 'body-1'
    })
    await h.store.updateMeta('doc-t4', { syncStatus: 'synced', syncedBodyId: 'body-1' })
    const edited = await h.store.writeCanvas({
      id: 'doc-t4',
      syncTargetId: TARGET_A,
      name: 'Original',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(640).fill(8),
      bodyId: 'body-2'
    })

    await h.outbox.enqueue({
      canvasId: 'doc-t4',
      type: 'putCanvas',
      revision: edited.revision,
      targetId: TARGET_A
    })
    const pumping = h.engine.pumpOnce()
    await gated.started

    // The rename lands while the bytes are on the wire.
    const renamed = await rename(h.store, 'doc-t4', 'Renamed mid-upload')
    await h.outbox.enqueue({
      canvasId: 'doc-t4',
      type: 'putMetadata',
      revision: renamed,
      targetId: TARGET_A
    })
    gated.release()
    await pumping
    await settle()

    // The completion write carries the NEW name, read from the row after the
    // upload — not the dispatch-time snapshot. The pre-fix behaviour wrote the
    // old name here, and the rename's job then wrote the new one: two different
    // payloads to one key a sub-second apart, the pattern B2 may reorder.
    const payloadNames = () =>
      inner.calls
        .filter((call) => call.op === 'putMetadata' && call.id === 'doc-t4')
        .map((call) => call.metadata?.name)
    expect(payloadNames()).toEqual(['Renamed mid-upload'])

    // The trailing metadata job writes the SAME payload — a benign duplicate,
    // never the old name.
    await h.engine.pumpOnce()
    await settle()
    expect(payloadNames()).toEqual(['Renamed mid-upload', 'Renamed mid-upload'])
    expect(inner.metas.get('doc-t4')?.name).toBe('Renamed mid-upload')

    // Converge fully: the body repair re-upload, then synced.
    await h.engine.pumpOnce()
    await settle()
    expect(inner.bodies.get('doc-t4')?.byteLength).toBe(640)
    expect(new Set(payloadNames())).toEqual(new Set(['Renamed mid-upload']))
    expect((await h.store.getMeta('doc-t4'))?.syncStatus).toBe('synced')
    h.dispose()
  })
})
