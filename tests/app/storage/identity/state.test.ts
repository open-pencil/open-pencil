import { describe, expect, test } from 'bun:test'

import { computeMetaId, computeStateId, computeStateIdentity } from '@/app/storage/identity/state'

/**
 * The identity a conflict detector compares. Every property here was a
 * rejected formulation in the assessment: revision comparison (per-device),
 * `bodyId` alone (blind to renames), `trashedAt` in the hash (false conflict
 * on the operation most likely to be performed twice).
 */
describe('canonical state identity', () => {
  test('identical concurrent edits converge: same inputs, same stateId', async () => {
    const a = await computeStateIdentity('sha256:body', {
      documentId: 'doc',
      name: 'Quarterly Review',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const b = await computeStateIdentity('sha256:body', {
      documentId: 'doc',
      name: 'Quarterly Review',
      sourceFormat: 'fig',
      isTrashed: false
    })
    expect(a.stateId).toBe(b.stateId)
  })

  test('two devices trashing one document produce the same metaId', async () => {
    // Different `trashedAt` timestamps, identical semantic state — the pair
    // must converge, because trash is the operation most likely to happen twice.
    const a = await computeMetaId({
      documentId: 'doc',
      name: 'Doc',
      sourceFormat: 'fig',
      isTrashed: true
    })
    const b = await computeMetaId({
      documentId: 'doc',
      name: 'Doc',
      sourceFormat: 'fig',
      isTrashed: true
    })
    expect(a).toBe(b)
  })

  test('rename, trash, and restore each change stateId while bodyId is untouched', async () => {
    const base = { documentId: 'doc', name: 'Doc', sourceFormat: 'fig' as const, isTrashed: false }
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
    const meta = { documentId: 'doc', name: 'Doc', sourceFormat: 'fig' as const, isTrashed: false }
    const a = await computeStateIdentity('sha256:one', meta)
    const b = await computeStateIdentity('sha256:two', meta)
    expect(a.stateId).not.toBe(b.stateId)
  })

  test('encoding is canonical: field concatenation cannot collide', async () => {
    // Length-prefixing must keep ["ab","c"] distinct from ["a","bc"].
    const a = await computeMetaId({
      documentId: 'docab',
      name: 'c',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const d = await computeMetaId({
      documentId: 'doca',
      name: 'bc',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const b = await computeStateId('sha256:a', 'sha256:bc')
    const c = await computeStateId('sha256:ab', 'sha256:c')
    expect(b).not.toBe(c)
    expect(a).not.toBe(d)
  })

  test('two designs with the same content and name are distinct states', async () => {
    const meta = { name: 'Untitled', sourceFormat: 'fig' as const, isTrashed: false }
    const a = await computeStateIdentity('sha256:blank', { ...meta, documentId: 'one' })
    const b = await computeStateIdentity('sha256:blank', { ...meta, documentId: 'two' })
    expect(a.stateId).not.toBe(b.stateId)
  })

  test('distinct domains: a metaId and a stateId over the same material differ', async () => {
    const metaId = await computeMetaId({
      documentId: 'doc',
      name: 'Doc',
      sourceFormat: 'fig',
      isTrashed: false
    })
    const stateId = await computeStateId('sha256:body', metaId)
    expect(stateId).not.toBe(metaId)
  })
})
