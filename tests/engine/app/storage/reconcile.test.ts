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
    syncTargetId: 's3-compatible#00000000',
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
    figSize: 1,
    bodyId: `sha256:${id}`,
    syncedBodyId: null
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

describe('unconfirmed legacy bodies', () => {
  test('reports a legacy row holding bytes nothing has identified', () => {
    // Rows written before body identity existed would otherwise never become
    // evictable, so the cache budget would stop being enforced entirely. They
    // are reported for RE-UPLOAD, not confirmed: listing membership proves a
    // body exists remotely, never that it matches the bytes on this device.
    const result = reconcileStorageDocuments(
      [localMeta('legacy', 'synced')],
      [remoteDocument('legacy')]
    )

    expect(result.bodyUnconfirmedIds).toEqual(['legacy'])
  })

  test('ignores a row missing from the remote listing', () => {
    const result = reconcileStorageDocuments([localMeta('ghost', 'synced')], [])

    expect(result.bodyUnconfirmedIds).toEqual([])
  })

  test('ignores a row whose body is already confirmed', () => {
    const confirmed = { ...localMeta('tracked', 'synced'), syncedBodyId: 'sha256:tracked' }

    const result = reconcileStorageDocuments([confirmed], [remoteDocument('tracked')])

    expect(result.bodyUnconfirmedIds).toEqual([])
  })

  test('ignores an index-only row, which has no local bytes to re-upload', () => {
    const indexOnly = { ...localMeta('remote', 'synced'), hasFig: false, bodyId: null }

    const result = reconcileStorageDocuments([indexOnly], [remoteDocument('remote')])

    expect(result.bodyUnconfirmedIds).toEqual([])
  })

  test('ignores a tombstoned row', () => {
    const result = reconcileStorageDocuments(
      [localMeta('deleted', 'synced', true)],
      [remoteDocument('deleted')]
    )

    expect(result.bodyUnconfirmedIds).toEqual([])
  })
})
