import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'

/**
 * The body is on the remote only if we know the local bytes AND matched them.
 *
 * `syncStatus === 'synced'` is not sufficient: a metadata-only put sets it
 * without any body reaching the remote.
 */
export function bodyIsConfirmed(meta: Pick<LocalCanvasMeta, 'bodyId' | 'syncedBodyId'>): boolean {
  return meta.bodyId !== null && meta.bodyId === meta.syncedBodyId
}

/** Newest-first, tombstones hidden unless asked for. */
export function sortAndFilterMetas(
  all: LocalCanvasMeta[],
  includeTombstones: boolean
): LocalCanvasMeta[] {
  const normalized = all.map(normalizeLocalCanvasMeta)
  const filtered = includeTombstones ? normalized : normalized.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Row shape before body identity replaced revision-based body inference. */
type LegacyBodyRevisionMeta = LocalCanvasMeta & { bodySyncedRevision?: number }

/**
 * Bring an IndexedDB row up to the current shape.
 *
 * Backfills format identity for rows written before decks were supported, and
 * migrates `bodySyncedRevision` to body identity.
 *
 * The migration is deliberately lossy in one direction: a legacy row can tell
 * us its bytes were *once* uploaded, but not WHICH bytes, because the revision
 * counter it recorded says nothing about content. Inventing a `syncedBodyId`
 * from it would claim a remote copy we cannot verify, and eviction would then
 * be free to delete the only copy. So `syncedBodyId` stays null and the row is
 * simply non-evictable until a real transfer confirms it.
 */
export function normalizeLocalCanvasMeta(meta: LocalCanvasMeta): LocalCanvasMeta {
  const { bodySyncedRevision: _legacy, ...rest } = meta as LegacyBodyRevisionMeta
  return {
    ...rest,
    sourceFormat: meta.sourceFormat === 'deck' ? 'deck' : 'fig',
    trashedAt: typeof meta.trashedAt === 'string' ? meta.trashedAt : null,
    // `hasFig` without a `bodyId` means a legacy row: bytes are present but
    // unidentified. The next save or open computes the real id.
    bodyId: meta.bodyId ?? null,
    syncedBodyId: meta.syncedBodyId ?? null
  }
}

/** Meta row for a full canvas write (fig bytes present). */
export function buildWriteMeta(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null,
  hasThumb: boolean
): LocalCanvasMeta {
  return {
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    sourceFormat: input.sourceFormat ?? existing?.sourceFormat ?? 'fig',
    trashedAt: input.trashedAt !== undefined ? input.trashedAt : (existing?.trashedAt ?? null),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    revision: input.revision ?? (existing ? existing.revision + 1 : 1),
    bodyId: input.bodyId ?? null,
    // New bytes are not on the remote yet, so the confirmed id deliberately
    // stays where it was until putCanvas acknowledges an upload.
    syncedBodyId: input.syncedBodyId ?? existing?.syncedBodyId ?? null,
    syncStatus: input.syncStatus ?? 'pending',
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    lastSyncError: input.syncStatus === 'synced' ? null : (existing?.lastSyncError ?? null),
    // A deleted canvas stays deleted — an in-flight autosave must not resurrect it
    tombstoned: existing?.tombstoned ?? false,
    hasFig: true,
    hasThumb,
    figSize: input.figBytes.byteLength,
    lastOpenedAt: existing?.lastOpenedAt
  }
}

/** Meta row for an index-only upsert (remote canvas, no local fig). */
export function buildIndexMeta(
  input: LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
): LocalCanvasMeta {
  return {
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    sourceFormat: input.sourceFormat ?? existing?.sourceFormat ?? 'fig',
    trashedAt: input.trashedAt !== undefined ? input.trashedAt : (existing?.trashedAt ?? null),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    // A listing carries no bytes, so an index-only row has no body identity of
    // its own — keep whatever a previous local write established.
    bodyId: input.bodyId ?? existing?.bodyId ?? null,
    syncedBodyId: input.syncedBodyId ?? existing?.syncedBodyId ?? null,
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false,
    figSize: existing?.figSize,
    // Preserve the LRU key: dropping it here reset eviction ordering on every
    // reconcile, which is why the cache behaved as least-recently-WRITTEN.
    lastOpenedAt: existing?.lastOpenedAt
  }
}
