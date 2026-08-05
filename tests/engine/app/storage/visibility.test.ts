import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import type { StorageTargetID } from '@/app/storage/target'
import {
  deviceStorageDocuments,
  mergeDeviceStorageDocuments,
  storageDocumentInScope,
  storageDocumentLocation,
  storageDocumentNeedsItsOwnTarget,
  storageDocumentPlacements
} from '@/app/storage/visibility'

const BACKBLAZE: StorageTargetID = 'backblaze-b2#aaaaaaaa'
const BUNNY: StorageTargetID = 'bunny-storage#bbbbbbbb'
const APPWRITE: StorageTargetID = 'appwrite-storage#cccccccc'
/** A destination whose provider this build does not ship. */
const RETIRED: StorageTargetID = 'dropbox-classic#dddddddd'

function meta(id: string, overrides: Partial<LocalCanvasMeta> = {}): LocalCanvasMeta {
  return {
    id,
    syncTargetId: null,
    lastKnownTargetId: null,
    name: `Document ${id}`,
    sourceFormat: 'fig',
    trashedAt: null,
    updatedAt: '2026-01-02T00:00:00.000Z',
    revision: 1,
    bodyId: `sha256:${id}`,
    syncedBodyId: null,
    baseStateId: null,
    syncStatus: 'local',
    lastSyncedAt: null,
    lastSyncError: null,
    lastThumbSyncError: null,
    tombstoned: false,
    hasFig: true,
    hasThumb: false,
    ...overrides
  }
}

function remoteDocument(id: string): StorageDocument {
  return {
    id,
    name: `Remote ${id}`,
    sourceFormat: 'fig',
    trashedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadataAuthoritative: true
  }
}

describe('storageDocumentLocation', () => {
  test('names the active destination when the row replicates there', () => {
    expect(storageDocumentLocation({ syncTargetId: BACKBLAZE }, BACKBLAZE)).toEqual({
      kind: 'backed-up-here',
      providerLabel: 'Backblaze B2 (S3)'
    })
  })

  test('names the other provider when the row replicates somewhere else', () => {
    expect(storageDocumentLocation({ syncTargetId: BUNNY }, BACKBLAZE)).toEqual({
      kind: 'backed-up-elsewhere',
      providerLabel: 'Bunny Storage (S3 beta)'
    })
  })

  test('reports a detached row against the destination it left', () => {
    expect(
      storageDocumentLocation({ syncTargetId: null, lastKnownTargetId: APPWRITE }, BACKBLAZE)
    ).toEqual({ kind: 'detached', providerLabel: 'Appwrite' })
  })

  test('reports a never-replicated row as held on this device alone', () => {
    expect(
      storageDocumentLocation({ syncTargetId: null, lastKnownTargetId: null }, BACKBLAZE)
    ).toEqual({ kind: 'device-only', providerLabel: null })
  })

  test('tests the current destination before the previous one', () => {
    // A row re-adopted by a target carries both. Where it replicates NOW is the
    // true answer; reading `lastKnownTargetId` first would report a document as
    // detached from the very bucket it is syncing to.
    const readopted = { syncTargetId: BACKBLAZE, lastKnownTargetId: BUNNY }
    expect(storageDocumentLocation(readopted, BACKBLAZE).kind).toBe('backed-up-here')
    expect(storageDocumentLocation(readopted, BUNNY).kind).toBe('backed-up-elsewhere')
  })

  test('degrades to a neutral label for a provider this build does not ship', () => {
    // The id comes back from durable storage, so this must be a state to report
    // rather than an exception thrown while painting a grid.
    expect(() => storageDocumentLocation({ syncTargetId: RETIRED }, BACKBLAZE)).not.toThrow()
    expect(storageDocumentLocation({ syncTargetId: RETIRED }, BACKBLAZE)).toEqual({
      kind: 'backed-up-elsewhere',
      providerLabel: null
    })
    expect(
      storageDocumentLocation({ syncTargetId: null, lastKnownTargetId: RETIRED }, BACKBLAZE)
    ).toEqual({ kind: 'detached', providerLabel: null })
  })

  test('does not call a homeless document backed up when no destination is configured', () => {
    // Both sides are null with no cloud connected, and plain equality would
    // report every local document as backed up to a bucket that does not exist.
    expect(storageDocumentLocation({ syncTargetId: null }, null).kind).toBe('device-only')
  })
})

describe('workspace document list', () => {
  test('lists rows with no destination while a remote target is active', () => {
    // The defect this closes: no query in the view ever asked for
    // `syncTargetId === null`, so a document with no destination matched no
    // filter and was rendered nowhere at all.
    const metas = [
      meta('local-only'),
      meta('detached', { lastKnownTargetId: APPWRITE }),
      meta('elsewhere', { syncTargetId: BUNNY }),
      meta('here', { syncTargetId: BACKBLAZE })
    ]

    expect(
      deviceStorageDocuments(metas)
        .map((document) => document.id)
        .sort()
    ).toEqual(['detached', 'elsewhere', 'here', 'local-only'])
  })

  test('excludes tombstoned rows in every scope', () => {
    const metas = [
      meta('gone', { tombstoned: true, syncTargetId: BACKBLAZE }),
      meta('gone-local', { tombstoned: true }),
      meta('kept')
    ]

    expect(deviceStorageDocuments(metas).map((document) => document.id)).toEqual(['kept'])
    // Even when the active target's listing still names the row: a delete in
    // flight is a lifecycle state, not a location.
    expect(
      mergeDeviceStorageDocuments([remoteDocument('gone')], metas).map((document) => document.id)
    ).toEqual(['kept'])
  })

  test('keeps rows from other destinations alongside the reconciled ones', () => {
    const metas = [
      meta('here', { syncTargetId: BACKBLAZE, updatedAt: '2026-01-03T00:00:00.000Z' }),
      meta('elsewhere', { syncTargetId: BUNNY, updatedAt: '2026-01-02T00:00:00.000Z' }),
      meta('local-only', { updatedAt: '2026-01-01T00:00:00.000Z' })
    ]
    const reconciled = [
      { ...remoteDocument('here'), updatedAt: '2026-01-03T00:00:00.000Z' },
      { ...remoteDocument('remote-seed'), updatedAt: '2026-01-04T00:00:00.000Z' }
    ]

    // Newest first, exactly as `updatedAt` orders them: location is a badge,
    // never a sort key and never a grouping.
    expect(mergeDeviceStorageDocuments(reconciled, metas).map((document) => document.id)).toEqual([
      'remote-seed',
      'here',
      'elsewhere',
      'local-only'
    ])
  })

  test('switching destination changes badges but never the row count', () => {
    // The invariant that would have caught the original defect.
    const metas = [
      meta('here', { syncTargetId: BACKBLAZE }),
      meta('elsewhere', { syncTargetId: BUNNY }),
      meta('local-only')
    ]
    const placements = storageDocumentPlacements(metas)

    // The whole refresh pipeline, per destination: narrow to the target that
    // produced the listing, reconcile, then merge back to the device.
    const listFor = (target: StorageTargetID) =>
      mergeDeviceStorageDocuments(
        reconcileStorageDocuments(
          metas.filter((row) => row.syncTargetId === target),
          []
        ).documents,
        metas
      )

    const onBackblaze = listFor(BACKBLAZE)
    const onBunny = listFor(BUNNY)
    expect(onBackblaze.length).toBe(3)
    expect(onBunny.length).toBe(onBackblaze.length)

    const kindsOn = (target: StorageTargetID) =>
      Object.fromEntries(
        Object.entries(placements).map(([id, placement]) => [
          id,
          storageDocumentLocation(placement, target).kind
        ])
      )
    expect(kindsOn(BACKBLAZE)).toEqual({
      here: 'backed-up-here',
      elsewhere: 'backed-up-elsewhere',
      'local-only': 'device-only'
    })
    expect(kindsOn(BUNNY)).toEqual({
      here: 'backed-up-elsewhere',
      elsewhere: 'backed-up-here',
      'local-only': 'device-only'
    })
  })

  test('the reported machine: 40 rows, active destination holding none', () => {
    // The exact shape that rendered "No stored documents yet." over a full
    // library: 23 rows with no destination, 4 on Bunny, 13 tombstoned on
    // Appwrite, active provider Backblaze B2 which holds nothing.
    const metas = [
      ...Array.from({ length: 23 }, (_, index) => meta(`local-${index}`)),
      ...Array.from({ length: 4 }, (_, index) => meta(`bunny-${index}`, { syncTargetId: BUNNY })),
      ...Array.from({ length: 13 }, (_, index) =>
        meta(`deleted-${index}`, { syncTargetId: APPWRITE, tombstoned: true })
      )
    ]

    // Backblaze lists nothing, so the reconciliation for the active target is
    // empty — which is precisely what used to become the whole grid.
    const listed = mergeDeviceStorageDocuments(
      reconcileStorageDocuments(
        metas.filter((row) => row.syncTargetId === BACKBLAZE),
        []
      ).documents,
      metas
    )

    expect(listed.length).toBe(27)
    expect(listed.some((document) => document.id.startsWith('deleted-'))).toBe(false)
  })
})

describe('destination scope', () => {
  const placements = storageDocumentPlacements([
    meta('here', { syncTargetId: BACKBLAZE }),
    meta('elsewhere', { syncTargetId: BUNNY }),
    meta('local-only')
  ])

  test('lists everything by default', () => {
    for (const id of Object.keys(placements)) {
      expect(storageDocumentInScope(placements[id], 'all', BACKBLAZE)).toBe(true)
    }
  })

  test('narrows to rows pinned to the active destination', () => {
    expect(storageDocumentInScope(placements.here, 'active-target', BACKBLAZE)).toBe(true)
    expect(storageDocumentInScope(placements.elsewhere, 'active-target', BACKBLAZE)).toBe(false)
    expect(storageDocumentInScope(placements['local-only'], 'active-target', BACKBLAZE)).toBe(false)
  })

  test('keeps a row the listing produced before the index recorded it', () => {
    expect(storageDocumentInScope(undefined, 'active-target', BACKBLAZE)).toBe(true)
  })
})

describe('storageDocumentNeedsItsOwnTarget', () => {
  test('an index-only row at another destination cannot be opened from here', () => {
    // Its bytes exist only in that bucket. Fetching the id from whichever
    // destination is active asks a different bucket for a document it never
    // held, and the row is listed precisely so the user can see where it lives.
    const placement = { syncTargetId: BUNNY, hasLocalBody: false }
    expect(storageDocumentNeedsItsOwnTarget(placement, BACKBLAZE)).toBe(true)
    expect(storageDocumentNeedsItsOwnTarget(placement, BUNNY)).toBe(false)
  })

  test('a row with local bytes always opens, whatever the active destination', () => {
    expect(
      storageDocumentNeedsItsOwnTarget({ syncTargetId: BUNNY, hasLocalBody: true }, BACKBLAZE)
    ).toBe(false)
    expect(storageDocumentNeedsItsOwnTarget({ syncTargetId: null, hasLocalBody: true }, null)).toBe(
      false
    )
  })

  test('says nothing about a row the local index has not recorded', () => {
    expect(storageDocumentNeedsItsOwnTarget(undefined, BACKBLAZE)).toBe(false)
  })

  test('a row predating syncTargetId is on this device, not somewhere else', async () => {
    // Rows written before the field existed carry `undefined`. A strict
    // `!== null` test reads that as "has a destination" and badges documents
    // that live only on this machine as backed up to a provider they have
    // never touched — a false claim about where the user's data is.
    const location = storageDocumentLocation(
      { syncTargetId: undefined as unknown as null },
      's3-compatible#aaaaaaaa'
    )

    expect(location.kind).toBe('device-only')
    expect(location.providerLabel).toBeNull()
  })
})
