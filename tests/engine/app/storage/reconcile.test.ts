import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'

function localMeta(
  id: string,
  syncStatus: LocalCanvasMeta['syncStatus'],
  tombstoned = false
): LocalCanvasMeta {
  return {
    id,
    providerId: 's3-compatible',
    name: `Local ${id}`,
    sourceFormat: id === 'pending' ? 'deck' : 'fig',
    updatedAt: '2026-01-02T00:00:00.000Z',
    revision: 1,
    syncStatus,
    lastSyncedAt: null,
    lastSyncError: null,
    tombstoned,
    hasFig: true,
    hasThumb: false,
    figSize: 1
  }
}

function remoteDocument(id: string): StorageDocument {
  return {
    id,
    name: `Remote ${id}`,
    sourceFormat: 'fig',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadataAuthoritative: true
  }
}

describe('storage workspace reconciliation', () => {
  test('keeps pending local metadata ahead of the remote listing', () => {
    const result = reconcileStorageDocuments(
      [localMeta('pending', 'pending')],
      [remoteDocument('pending'), remoteDocument('remote')]
    )

    expect(result.documents.map((document) => document.name)).toEqual([
      'Local pending',
      'Remote remote'
    ])
    expect(result.remoteDocumentsToSeed.map((document) => document.id)).toEqual(['remote'])
    expect(result.documents[0]?.sourceFormat).toBe('deck')
  })

  test('hides tombstones until deletion is confirmed and then purges them', () => {
    const waiting = reconcileStorageDocuments(
      [localMeta('deleted', 'synced', true)],
      [remoteDocument('deleted')]
    )
    expect(waiting.documents).toEqual([])
    expect(waiting.localIdsToPurge).toEqual([])
    expect(waiting.remoteDocumentsToSeed).toEqual([])

    const confirmed = reconcileStorageDocuments([localMeta('deleted', 'synced', true)], [])
    expect(confirmed.localIdsToPurge).toEqual(['deleted'])
  })
})

describe('body-upload confirmation backfill', () => {
  test('confirms legacy synced rows that appear in the remote listing', () => {
    // Rows written before bodySyncedRevision existed would otherwise never be
    // evictable, so the cache budget would stop being enforced entirely.
    const result = reconcileStorageDocuments(
      [localMeta('legacy', 'synced')],
      [remoteDocument('legacy')]
    )

    expect(result.bodyConfirmedIds).toEqual(['legacy'])
  })

  test('does not confirm a row missing from the remote listing', () => {
    const result = reconcileStorageDocuments([localMeta('ghost', 'synced')], [])

    expect(result.bodyConfirmedIds).toEqual([])
  })

  test('does not confirm a pending row', () => {
    // The listing proves an OLDER body exists, never the current unsynced one.
    const result = reconcileStorageDocuments(
      [localMeta('dirty', 'pending')],
      [remoteDocument('dirty')]
    )

    expect(result.bodyConfirmedIds).toEqual([])
  })

  test('does not re-confirm a row whose body revision is already tracked', () => {
    const tracked = { ...localMeta('tracked', 'synced'), bodySyncedRevision: 1 }

    const result = reconcileStorageDocuments([tracked], [remoteDocument('tracked')])

    expect(result.bodyConfirmedIds).toEqual([])
  })

  test('does not confirm a tombstoned row', () => {
    const result = reconcileStorageDocuments(
      [localMeta('deleted', 'synced', true)],
      [remoteDocument('deleted')]
    )

    expect(result.bodyConfirmedIds).toEqual([])
  })
})
