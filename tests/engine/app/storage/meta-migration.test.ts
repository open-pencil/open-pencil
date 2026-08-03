import { describe, expect, test } from 'bun:test'

import { normalizeLocalCanvasMeta } from '@/app/storage/local-store/meta'

/** Injected so the migration is not coupled to whatever this machine has configured. */
const resolveTarget = () => 's3-compatible#deadbeef'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'

/**
 * Rows as they exist in real IndexedDB installs, at every schema this app has
 * shipped. The migration runs over user data, so a mistake here does not
 * annoy someone — it deletes their documents.
 */
type AnyStoredRow = Record<string, unknown>

function row(overrides: AnyStoredRow = {}): LocalCanvasMeta {
  return {
    id: 'doc-1',
    name: 'Quarterly deck',
    sourceFormat: 'deck',
    trashedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 4,
    syncStatus: 'synced',
    lastSyncedAt: '2026-01-01T00:00:00.000Z',
    lastSyncError: null,
    tombstoned: false,
    hasFig: true,
    hasThumb: true,
    figSize: 2048,
    lastOpenedAt: '2026-05-05T00:00:00.000Z',
    ...overrides
  } as unknown as LocalCanvasMeta
}

describe('normalizeLocalCanvasMeta', () => {
  test('a pre-body-identity row never claims a confirmed remote copy', () => {
    // The legacy row records that bytes were once uploaded, but not WHICH
    // bytes — a revision counter says nothing about content. Inventing a
    // syncedBodyId from it would let eviction delete the only copy.
    const migrated = normalizeLocalCanvasMeta(
      row({ bodySyncedRevision: 4, providerId: 's3-compatible' }),
      resolveTarget
    )

    expect(migrated.bodyId).toBeNull()
    expect(migrated.syncedBodyId).toBeNull()
  })

  test('a row with neither legacy field migrates without inventing state', () => {
    const migrated = normalizeLocalCanvasMeta(row({ providerId: 's3-compatible' }), resolveTarget)

    expect(migrated.bodyId).toBeNull()
    expect(migrated.syncedBodyId).toBeNull()
    expect(migrated.lastThumbSyncError).toBeNull()
  })

  test('preserves everything eviction and ordering depend on', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ bodySyncedRevision: 4, providerId: 's3-compatible' })
    )

    // lastOpenedAt is the LRU key; figSize is the budget input. Dropping
    // either silently changes which document gets evicted first.
    expect(migrated.lastOpenedAt).toBe('2026-05-05T00:00:00.000Z')
    expect(migrated.figSize).toBe(2048)
    expect(migrated.revision).toBe(4)
    expect(migrated.hasFig).toBe(true)
  })

  test('is idempotent — running twice changes nothing', () => {
    const once = normalizeLocalCanvasMeta(
      row({ bodySyncedRevision: 4, providerId: 's3-compatible' }),
      resolveTarget
    )
    const twice = normalizeLocalCanvasMeta(once, resolveTarget)

    expect(twice).toEqual(once)
  })

  test('does not resurrect a tombstone', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ tombstoned: true, providerId: 's3-compatible' })
    )

    expect(migrated.tombstoned).toBe(true)
  })

  test('leaves an index-only row without a body identity', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ hasFig: false, figSize: undefined, providerId: 's3-compatible' })
    )

    expect(migrated.hasFig).toBe(false)
    expect(migrated.bodyId).toBeNull()
  })

  test('drops the legacy body-revision field entirely', () => {
    // One schema version: no row may persist body identity alongside the
    // legacy counter, or a later migration has to recognise a state that
    // should never have reached disk.
    const migrated = normalizeLocalCanvasMeta(
      row({ bodySyncedRevision: 4, providerId: 's3-compatible' })
    )

    expect('bodySyncedRevision' in migrated).toBe(false)
  })

  test('backfills a deck format written before decks were supported', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ sourceFormat: undefined, providerId: 's3-compatible' })
    )

    expect(migrated.sourceFormat).toBe('fig')
  })

  test('normalises a non-string trashedAt to null', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ trashedAt: undefined, providerId: 's3-compatible' })
    )

    expect(migrated.trashedAt).toBeNull()
  })
})

describe('legacy provider to target migration', () => {
  test('maps a legacy provider row to the destination that provider names now', () => {
    // A legacy row records WHICH PROVIDER it synced to, never which bucket.
    // Pointing it at the current destination is safe precisely because
    // `syncedBodyId` stays null: nothing treats it as durably remote, so the
    // next save re-uploads it to where the user actually wants it.
    const migrated = normalizeLocalCanvasMeta(
      row({ providerId: 's3-compatible' }),
      () => 's3-compatible#deadbeef'
    )

    expect(migrated.syncTargetId).toBe('s3-compatible#deadbeef')
    expect(migrated.syncedBodyId).toBeNull()
  })

  test('leaves a row local-only when its provider names no destination', () => {
    // Unconfigured provider. Guessing a target here would be worse than none:
    // the row would claim to replicate somewhere that does not exist.
    const migrated = normalizeLocalCanvasMeta(row({ providerId: 's3-compatible' }), () => null)

    expect(migrated.syncTargetId).toBeNull()
  })

  test('never re-resolves an already-migrated null target', () => {
    // `null` is a real migrated value meaning local-only, distinct from a
    // pre-target row. Re-resolving it would silently attach a destination the
    // user never chose.
    const migrated = normalizeLocalCanvasMeta(row({ syncTargetId: null }), () => 's3-compatible#x')

    expect(migrated.syncTargetId).toBeNull()
  })

  test('does not move a row that already has a target', () => {
    const migrated = normalizeLocalCanvasMeta(
      row({ syncTargetId: 's3-compatible#original' }),
      () => 's3-compatible#somewhere-else'
    )

    expect(migrated.syncTargetId).toBe('s3-compatible#original')
  })
})
