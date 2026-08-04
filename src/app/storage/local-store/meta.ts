import type { StorageProviderID } from '@/app/integrations/storage/types'
import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'
import { currentStorageTarget, type StorageTargetID } from '@/app/storage/target'

const defaultTargetResolver: TargetResolver = (providerId) =>
  currentStorageTarget(providerId)?.id ?? null

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
  const normalized = all.map((meta) => normalizeLocalCanvasMeta(meta))
  const filtered = includeTombstones ? normalized : normalized.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Row shape before body identity and target identity replaced their legacy fields. */
type LegacyMeta = LocalCanvasMeta & {
  bodySyncedRevision?: number
  providerId?: StorageProviderID
}

/**
 * Maps a legacy row's provider to the destination that provider names today.
 *
 * A legacy row records only WHICH PROVIDER it synced to, never which bucket, so
 * this cannot recover where its bytes actually went. That is safe for a row:
 * `syncedBodyId` stays null, so nothing treats it as durably remote and the
 * next save re-uploads it to the current destination — which is where the user
 * wants it. It would NOT be safe for a queued job, whose bytes were intended
 * for a specific place; those are pinned separately and parked when ambiguous.
 */
export type TargetResolver = (providerId: StorageProviderID) => StorageTargetID | null

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
export function normalizeLocalCanvasMeta(
  meta: LocalCanvasMeta,
  resolveTarget: TargetResolver = defaultTargetResolver
): LocalCanvasMeta {
  const {
    bodySyncedRevision: _legacyBody,
    providerId: legacyProvider,
    ...rest
  } = meta as LegacyMeta
  return {
    ...rest,
    // `syncTargetId === undefined` means a pre-target row. `null` is a real,
    // migrated value meaning local-only, so it must not be re-resolved.
    syncTargetId:
      meta.syncTargetId !== undefined
        ? meta.syncTargetId
        : legacyProvider
          ? resolveTarget(legacyProvider)
          : null,
    sourceFormat: meta.sourceFormat === 'deck' ? 'deck' : 'fig',
    trashedAt: typeof meta.trashedAt === 'string' ? meta.trashedAt : null,
    // `hasFig` without a `bodyId` means a legacy row: bytes are present but
    // unidentified. The next save or open computes the real id.
    bodyId: meta.bodyId ?? null,
    syncedBodyId: meta.syncedBodyId ?? null,
    // Pre-identity rows have no recorded base: `null` = unknown, which never
    // conflicts on its own — the first acknowledged write establishes it.
    baseStateId: meta.baseStateId ?? null,
    // Rows written before thumbnail failures were separated recorded them in
    // `lastSyncError`. Nothing can tell them apart after the fact, so they stay
    // where they are and simply age out; only new failures land here.
    lastThumbSyncError: meta.lastThumbSyncError ?? null
  }
}

/** Meta row for a full canvas write (fig bytes present). */
export function buildWriteMeta(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null,
  hasThumb: boolean
): LocalCanvasMeta {
  // A write that names a different destination is a retarget. Confirmation
  // belongs to the target that gave it: carried across, the new bucket inherits
  // a claim that it holds bytes it has never seen, and eviction would then be
  // free to delete the only copy.
  const retargeted = existing !== null && existing.syncTargetId !== input.syncTargetId
  return {
    id: input.id,
    syncTargetId: input.syncTargetId,
    name: input.name,
    sourceFormat: input.sourceFormat ?? existing?.sourceFormat ?? 'fig',
    trashedAt: input.trashedAt !== undefined ? input.trashedAt : (existing?.trashedAt ?? null),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    revision: input.revision ?? (existing ? existing.revision + 1 : 1),
    bodyId: input.bodyId ?? null,
    // New bytes are not on the remote yet, so the confirmed id deliberately
    // stays where it was until putCanvas acknowledges an upload.
    syncedBodyId: input.syncedBodyId ?? (retargeted ? null : (existing?.syncedBodyId ?? null)),
    // The conflict base describes a state AT A DESTINATION: a retarget moves
    // the document to a bucket whose state we have not acknowledged, so the
    // base clears alongside the body confirmation.
    baseStateId: input.baseStateId ?? (retargeted ? null : (existing?.baseStateId ?? null)),
    syncStatus: input.syncStatus ?? 'pending',
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    lastSyncError: input.syncStatus === 'synced' ? null : (existing?.lastSyncError ?? null),
    // Survives a body write: new bytes say nothing about whether the previous
    // preview upload reached the remote.
    lastThumbSyncError: existing?.lastThumbSyncError ?? null,
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
    syncTargetId: input.syncTargetId,
    name: input.name,
    sourceFormat: input.sourceFormat ?? existing?.sourceFormat ?? 'fig',
    trashedAt: input.trashedAt !== undefined ? input.trashedAt : (existing?.trashedAt ?? null),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    // A listing carries no bytes, so an index-only row has no body identity of
    // its own — keep whatever a previous local write established.
    bodyId: input.bodyId ?? existing?.bodyId ?? null,
    syncedBodyId: input.syncedBodyId ?? existing?.syncedBodyId ?? null,
    baseStateId: input.baseStateId ?? existing?.baseStateId ?? null,
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    lastThumbSyncError: input.lastThumbSyncError ?? existing?.lastThumbSyncError ?? null,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false,
    figSize: existing?.figSize,
    // Preserve the LRU key: dropping it here reset eviction ordering on every
    // reconcile, which is why the cache behaved as least-recently-WRITTEN.
    lastOpenedAt: existing?.lastOpenedAt
  }
}
