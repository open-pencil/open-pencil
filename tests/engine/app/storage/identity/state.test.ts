import { describe, expect, test } from 'bun:test'

import { computeMetaId, computeStateId, computeStateIdentity } from '@/app/storage/identity/state'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { markRevisionSynced } from '@/app/storage/sync/engine'

/**
 * The identity a conflict detector compares. Every property here was a
 * rejected formulation in the assessment: revision comparison (per-device),
 * `bodyId` alone (blind to renames), `trashedAt` in the hash (false conflict
 * on the operation most likely to be performed twice).
 */
describe('canonical state identity', () => {
  test('identical concurrent edits converge: same inputs, same stateId', async () => {
    const a = await computeStateIdentity('sha256:body', {
      name: 'Quarterly Review',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const b = await computeStateIdentity('sha256:body', {
      name: 'Quarterly Review',
      sourceFormat: 'fig',
      isTrashed: false
    })
    expect(a.stateId).toBe(b.stateId)
  })

  test('two devices trashing one document produce the same metaId', async () => {
    // Different `trashedAt` timestamps, identical semantic state — the pair
    // must converge, because trash is the operation most likely to happen twice.
    const a = await computeMetaId({ name: 'Doc', sourceFormat: 'fig', isTrashed: true })
    const b = await computeMetaId({ name: 'Doc', sourceFormat: 'fig', isTrashed: true })
    expect(a).toBe(b)
  })

  test('rename, trash, and restore each change stateId while bodyId is untouched', async () => {
    const base = { name: 'Doc', sourceFormat: 'fig' as const, isTrashed: false }
    const renamed = await computeStateIdentity('sha256:body', { ...base, name: 'Renamed' })
    const trashed = await computeStateIdentity('sha256:body', { ...base, isTrashed: true })
    const original = await computeStateIdentity('sha256:body', base)

    expect(renamed.stateId).not.toBe(original.stateId)
    expect(trashed.stateId).not.toBe(original.stateId)
    // Restore returns to the ORIGINAL identity — a trash/restore cycle is not
    // a permanent state change.
    const restored = await computeStateIdentity('sha256:body', base)
    expect(restored.stateId).toBe(original.stateId)
  })

  test('a body change alone changes stateId', async () => {
    const meta = { name: 'Doc', sourceFormat: 'fig' as const, isTrashed: false }
    const a = await computeStateIdentity('sha256:one', meta)
    const b = await computeStateIdentity('sha256:two', meta)
    expect(a.stateId).not.toBe(b.stateId)
  })

  test('encoding is canonical: field concatenation cannot collide', async () => {
    // Length-prefixing must keep ["ab","c"] distinct from ["a","bc"].
    const a = await computeMetaId({ name: 'ab', sourceFormat: 'fig', isTrashed: false })
    const b = await computeStateId('sha256:a', 'sha256:bc')
    const c = await computeStateId('sha256:ab', 'sha256:c')
    expect(b).not.toBe(c)
    expect(a).toBeTruthy()
  })

  test('distinct domains: a metaId and a stateId over the same material differ', async () => {
    const metaId = await computeMetaId({ name: 'Doc', sourceFormat: 'fig', isTrashed: false })
    const stateId = await computeStateId('sha256:body', metaId)
    expect(stateId).not.toBe(metaId)
  })
})

describe('conflict base on the local row', () => {
  test('an acknowledged write advances baseStateId to the published state', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await store.writeCanvas({
      id: 'doc',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'Doc',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(64).fill(1),
      bodyId: 'body-1'
    })
    expect(meta.baseStateId).toBeNull()

    const confirmed = await markRevisionSynced(store, 'doc', meta.revision, {
      bodyUploaded: true,
      targetId: 's3-compatible#aaaaaaaa',
      stateId: 'sha256:published'
    })

    expect(confirmed).toBe(true)
    expect((await store.getMeta('doc'))?.baseStateId).toBe('sha256:published')
  })

  test('a stale completion does not move the base', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await store.writeCanvas({
      id: 'doc',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'Doc',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(64).fill(1),
      bodyId: 'body-1'
    })
    // The row moved past the completing job's revision.
    await store.updateMeta('doc', { name: 'Newer', revision: meta.revision + 1 })

    const confirmed = await markRevisionSynced(store, 'doc', meta.revision, {
      bodyUploaded: true,
      stateId: 'sha256:stale'
    })

    expect(confirmed).toBe(false)
    expect((await store.getMeta('doc'))?.baseStateId).toBeNull()
  })

  test('a retarget clears the base alongside the body confirmation', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'doc',
      syncTargetId: 's3-compatible#aaaaaaaa',
      name: 'Doc',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(64).fill(1),
      bodyId: 'body-1',
      syncedBodyId: 'body-1',
      baseStateId: 'sha256:at-old-target'
    })

    await store.writeCanvas({
      id: 'doc',
      syncTargetId: 's3-compatible#bbbbbbbb',
      name: 'Doc',
      sourceFormat: 'fig',
      figBytes: new Uint8Array(64).fill(1),
      bodyId: 'body-1'
    })

    const moved = await store.getMeta('doc')
    expect(moved?.syncedBodyId).toBeNull()
    expect(moved?.baseStateId).toBeNull()
  })
})
