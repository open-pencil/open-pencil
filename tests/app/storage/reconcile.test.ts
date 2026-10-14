import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { HEAD_HISTORY_LIMIT } from '@/app/integrations/storage/versioned/head'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'

const DESTINATION = 's3-compatible#bucket-1'

function remote(id: string, patch: Partial<StorageDocument> = {}): StorageDocument {
  return {
    id,
    name: id,
    updatedAt: '2026-08-04T00:00:00.000Z',
    sourceFormat: 'fig',
    trashedAt: null,
    metadataAuthoritative: true,
    versioned: true,
    bodyId: 'body-1',
    stateId: 'state-1',
    history: ['state-1'],
    ...patch
  }
}

/** A clean row that committed `state-1` with local bytes `body-1`. */
async function cleanRow(
  id: string,
  patch: Partial<LocalCanvasMeta> = {}
): Promise<LocalCanvasMeta> {
  const store = createMemoryLocalCanvasStore()
  await store.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    updatedAt: '2026-08-04T00:00:00.000Z',
    figBytes: new Uint8Array([1]),
    bodyId: 'body-1',
    syncedBodyId: 'body-1',
    baseStateId: 'state-1',
    versionedConfirmed: true,
    syncDestination: DESTINATION,
    syncStatus: 'synced'
  })
  const row = await store.updateMeta(id, {
    lastPublishedStateId: 'state-1',
    lastPublishedParentStateId: 'state-0',
    ...patch
  })
  if (!row) throw new Error('row missing')
  return row
}

describe('reconcileStorageDocuments', () => {
  test('a clean row follows a newer remote state, dropping bytes of another body', async () => {
    const row = await cleanRow('doc')
    const moved = remote('doc', {
      name: 'Renamed elsewhere',
      stateId: 'state-2',
      bodyId: 'body-2',
      history: ['state-2', 'state-1']
    })

    const result = reconcileStorageDocuments([row], [moved], DESTINATION)

    expect(result.remoteUpdates).toEqual([{ document: moved, dropLocalBody: true }])
    expect(result.forkedIds).toEqual([])
    expect(result.documents[0]?.name).toBe('Renamed elsewhere')
  })

  test('a row with local work wins over the listing', async () => {
    const row = await cleanRow('doc', { syncStatus: 'pending', name: 'Mine' })

    const result = reconcileStorageDocuments([row], [remote('doc', { stateId: 'state-2' })])

    expect(result.remoteUpdates).toEqual([])
    expect(result.documents[0]?.name).toBe('Mine')
  })

  test('a publish missing from a short remote history is a fork', async () => {
    const row = await cleanRow('doc')
    const raced = remote('doc', { stateId: 'state-b', history: ['state-b', 'state-0'] })

    const result = reconcileStorageDocuments([row], [raced], DESTINATION)

    expect(result.forkedIds).toEqual(['doc'])
    expect(result.remoteUpdates).toEqual([])
  })

  test('a publish that aged out of a full history is no fork, unless its parent is still there', async () => {
    const row = await cleanRow('doc')
    const newer = Array.from({ length: HEAD_HISTORY_LIMIT }, (_, index) => `later-${index}`)
    const aged = remote('doc', { stateId: 'later-0', history: newer })
    const raced = remote('doc', { stateId: 'later-0', history: [...newer.slice(0, -1), 'state-0'] })

    expect(reconcileStorageDocuments([row], [aged], DESTINATION).forkedIds).toEqual([])
    expect(reconcileStorageDocuments([row], [raced], DESTINATION).forkedIds).toEqual(['doc'])
  })

  test('bytes listed remotely but not confirmed in the versioned layout upload once; decks never', async () => {
    const legacy = await cleanRow('legacy', { syncedBodyId: null, versionedConfirmed: false })
    const deck = await cleanRow('deck', {
      sourceFormat: 'deck',
      syncedBodyId: null,
      versionedConfirmed: false
    })
    const confirmed = await cleanRow('confirmed')

    const result = reconcileStorageDocuments(
      [legacy, deck, confirmed],
      [remote('legacy'), remote('deck', { sourceFormat: 'deck' }), remote('confirmed')],
      DESTINATION
    )

    expect(result.bodyUnconfirmedIds).toEqual(['legacy'])
  })

  test('remote designs unknown here are seeded, decks included, and tombstones never revive', async () => {
    const gone = await cleanRow('gone', { tombstoned: true })

    const result = reconcileStorageDocuments(
      [gone],
      [remote('gone'), remote('slides', { sourceFormat: 'deck' })],
      DESTINATION
    )

    expect(result.remoteDocumentsToSeed.map((document) => document.id)).toEqual(['slides'])
    expect(result.documents.map((document) => document.id)).toEqual(['slides'])
    expect(result.localIdsToPurge).toEqual([])
  })
})
