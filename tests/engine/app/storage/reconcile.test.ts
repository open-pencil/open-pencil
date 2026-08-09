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

/** A row with no bytes here and none at the target: openable from nowhere. */
function indexOnlyMeta(id: string, syncStatus: LocalCanvasMeta['syncStatus']): LocalCanvasMeta {
  return { ...localMeta(id, syncStatus), hasFig: false, bodyId: null, figSize: 0 }
}

describe('unreachable remote-only rows', () => {
  test('reports a synced index-only row the listing does not contain', () => {
    const result = reconcileStorageDocuments([indexOnlyMeta('evicted', 'synced')], [])

    expect(result.unavailableIds).toEqual(['evicted'])
  })

  test('keeps the unavailable row visible and never purges it', () => {
    // Surfacing it must not remove it: absence from a listing is not deletion,
    // and dropping the row would destroy the only record that it ever existed.
    const result = reconcileStorageDocuments([indexOnlyMeta('evicted', 'synced')], [])

    expect(result.documents.map((document) => document.id)).toEqual(['evicted'])
    expect(result.localIdsToPurge).toEqual([])
  })

  test('recovers on its own when a later listing contains the row again', () => {
    // The mid-replacement case: another device deleted the body to re-upload it
    // (Appwrite files are immutable by id), so one listing misses it and the
    // next has it back. No user action, no stored state to clear.
    const row = indexOnlyMeta('replacing', 'synced')

    expect(reconcileStorageDocuments([row], []).unavailableIds).toEqual(['replacing'])
    expect(reconcileStorageDocuments([row], [remoteDocument('replacing')]).unavailableIds).toEqual(
      []
    )
  })

  test('leaves a row holding local bytes available however the listing looks', () => {
    // Local bytes are the point: they open without the network, so an absent
    // remote copy is a backup problem, not an availability one.
    const result = reconcileStorageDocuments([localMeta('cached', 'synced')], [])

    expect(result.unavailableIds).toEqual([])
  })

  test('ignores a row that is not claiming to be synced', () => {
    // `pending` and `error` rows already carry their own sync state, and a row
    // still queued for upload is absent from the listing by design.
    expect(
      reconcileStorageDocuments([indexOnlyMeta('queued', 'pending')], []).unavailableIds
    ).toEqual([])
    expect(
      reconcileStorageDocuments([indexOnlyMeta('failed', 'error')], []).unavailableIds
    ).toEqual([])
    expect(
      reconcileStorageDocuments([indexOnlyMeta('offline', 'local')], []).unavailableIds
    ).toEqual([])
  })

  test('ignores a tombstoned row, which is on its way out anyway', () => {
    const tombstoned = { ...indexOnlyMeta('deleted', 'synced'), tombstoned: true }

    expect(reconcileStorageDocuments([tombstoned], []).unavailableIds).toEqual([])
  })
})

describe('metadata authority between a local row and a listing', () => {
  const trashed = {
    ...localMeta('doc', 'synced'),
    trashedAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z'
  }

  test('a stale remote copy does not revert a local edit', () => {
    // Appwrite serves downloads with a 45-day max-age, so a listing can read the
    // pre-trash sidecar out of the HTTP cache. `synced` means the bytes reached
    // the target, never that this listing saw the newest metadata.
    const { documents } = reconcileStorageDocuments(
      [trashed],
      [{ ...remoteDocument('doc'), updatedAt: '2026-01-01T00:00:00.000Z' }]
    )
    expect(documents[0]?.trashedAt).toBe('2026-01-03T00:00:00.000Z')
    expect(documents[0]?.name).toBe('Local doc')
  })

  test('a genuinely newer remote copy still wins', () => {
    // Another device edited it after we did. That is the case this branch exists
    // for, and narrowing it must not turn the workspace into local-only.
    const { documents } = reconcileStorageDocuments(
      [trashed],
      [{ ...remoteDocument('doc'), updatedAt: '2026-01-04T00:00:00.000Z' }]
    )
    expect(documents[0]?.name).toBe('Remote doc')
    expect(documents[0]?.trashedAt).toBeUndefined()
  })

  test('a remote row carrying no metadata never wins', () => {
    // Non-authoritative means the sidecar was missing or unreadable: the name is
    // the document id and `trashedAt` is a default. Letting it through would
    // rename documents as well as untrash them.
    const { documents } = reconcileStorageDocuments(
      [trashed],
      [
        {
          ...remoteDocument('doc'),
          updatedAt: '2026-01-09T00:00:00.000Z',
          metadataAuthoritative: false
        }
      ]
    )
    expect(documents[0]?.name).toBe('Local doc')
    expect(documents[0]?.trashedAt).toBe('2026-01-03T00:00:00.000Z')
  })
})
