import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasSyncFields,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'

/** Fields added by versioned sync; rows written before it lack them on disk. */
type VersionedFields = LocalCanvasSyncFields &
  Pick<LocalCanvasMeta, 'lastPublishedStateId' | 'lastPublishedParentStateId'>

/** A row as it may be stored: older rows lack the versioned-sync fields. */
export type StoredLocalCanvasMeta = Omit<LocalCanvasMeta, keyof VersionedFields> &
  Partial<VersionedFields>

/**
 * The body is at the destination only if the local bytes are known and match the confirmed
 * ones. `syncStatus === 'synced'` is not enough: a metadata-only write sets it too.
 */
export function bodyIsConfirmed(meta: Pick<LocalCanvasMeta, 'bodyId' | 'syncedBodyId'>): boolean {
  return meta.bodyId !== null && meta.bodyId === meta.syncedBodyId
}

/**
 * Bring a stored row to the current shape, without a database upgrade. Older rows carry no
 * identity: their bytes are unidentified until the next save or open, and nothing claims a
 * remote copy, so eviction keeps them until a versioned commit confirms one.
 */
export function normalizeLocalCanvasMeta(meta: StoredLocalCanvasMeta): LocalCanvasMeta {
  return {
    ...meta,
    sourceFormat: meta.sourceFormat === 'deck' ? 'deck' : 'fig',
    trashedAt: typeof meta.trashedAt === 'string' ? meta.trashedAt : null,
    bodyId: meta.bodyId ?? null,
    syncedBodyId: meta.syncedBodyId ?? null,
    baseStateId: meta.baseStateId ?? null,
    lastPublishedStateId: meta.lastPublishedStateId ?? null,
    lastPublishedParentStateId: meta.lastPublishedParentStateId ?? null,
    versionedConfirmed: meta.versionedConfirmed ?? false,
    syncDestination: meta.syncDestination ?? null
  }
}

/** Newest-first, tombstones hidden unless asked for. */
export function sortAndFilterMetas(
  all: StoredLocalCanvasMeta[],
  includeTombstones: boolean
): LocalCanvasMeta[] {
  const normalized = all.map(normalizeLocalCanvasMeta)
  const filtered = includeTombstones ? normalized : normalized.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function given<Value>(value: Value | undefined, fallback: Value): Value {
  return value === undefined ? fallback : value
}

/**
 * What a row is, as opposed to where its sync stands. A write that omits the format or the trash
 * state keeps the row's own, so a partial write can neither retype a design nor restore it.
 */
function identityFields(
  input: LocalCanvasWriteInput | LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
) {
  return {
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    sourceFormat: input.sourceFormat ?? existing?.sourceFormat ?? 'fig',
    trashedAt: given(input.trashedAt, existing?.trashedAt ?? null)
  }
}

/**
 * Confirmations belong to the destination that gave them. A write that names another
 * destination starts from none, so a new bucket never inherits a claim to bytes it has not seen.
 */
function confirmationFields(
  input: LocalCanvasWriteInput | LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
) {
  const syncDestination = given(input.syncDestination, existing?.syncDestination ?? null)
  const moved =
    existing !== null &&
    existing.syncDestination !== null &&
    input.syncDestination !== undefined &&
    input.syncDestination !== existing.syncDestination
  const kept = moved ? null : existing
  return {
    syncDestination,
    syncedBodyId: given(input.syncedBodyId, kept?.syncedBodyId ?? null),
    baseStateId: given(input.baseStateId, kept?.baseStateId ?? null),
    // Only a commit records a publish; neither a save nor a listing sets it.
    lastPublishedStateId: kept?.lastPublishedStateId ?? null,
    lastPublishedParentStateId: kept?.lastPublishedParentStateId ?? null,
    versionedConfirmed: given(input.versionedConfirmed, kept?.versionedConfirmed ?? false)
  }
}

/** Meta row for a full canvas write (fig bytes present). */
export function buildWriteMeta(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null,
  hasThumb: boolean
): LocalCanvasMeta {
  return {
    ...identityFields(input, existing),
    ...confirmationFields(input, existing),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    revision: input.revision ?? (existing ? existing.revision + 1 : 1),
    // New bytes are not at the destination yet; the confirmed id stays until a commit.
    bodyId: input.bodyId ?? null,
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
    ...identityFields(input, existing),
    ...confirmationFields(input, existing),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    // A listing carries no bytes: keep what a local write established.
    bodyId: given(input.bodyId, existing?.bodyId ?? null),
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false,
    figSize: existing?.figSize,
    // The LRU key survives a listing, so eviction stays least-recently-opened.
    lastOpenedAt: existing?.lastOpenedAt
  }
}
