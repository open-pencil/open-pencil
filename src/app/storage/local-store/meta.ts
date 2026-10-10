import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'

/** Newest-first, tombstones hidden unless asked for. */
export function sortAndFilterMetas(
  all: LocalCanvasMeta[],
  includeTombstones: boolean
): LocalCanvasMeta[] {
  const filtered = includeTombstones ? all : all.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * Local edits keep the revision they build on and any unresolved conflict; bytes written straight
 * from the provider replace the base revision and leave nothing to resolve.
 */
function writtenRevisions(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null
): Pick<LocalCanvasMeta, 'remoteRevision' | 'conflictRevision'> {
  if (input.remoteRevision !== undefined) {
    return { remoteRevision: input.remoteRevision, conflictRevision: null }
  }
  return {
    remoteRevision: existing?.remoteRevision ?? null,
    conflictRevision: existing?.conflictRevision ?? null
  }
}

type CanvasIdentity = Pick<
  LocalCanvasMeta,
  'id' | 'providerId' | 'profileId' | 'containerId' | 'name'
>

/** A write may omit where the canvas lives; it stays where it was. */
function canvasIdentity(input: CanvasIdentity, existing: LocalCanvasMeta | null): CanvasIdentity {
  return {
    id: input.id,
    providerId: input.providerId,
    profileId: input.profileId ?? existing?.profileId,
    containerId: input.containerId ?? existing?.containerId,
    name: input.name
  }
}

/** Meta row for a full canvas write (fig bytes present). */
export function buildWriteMeta(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null,
  hasThumb: boolean
): LocalCanvasMeta {
  return {
    ...canvasIdentity(input, existing),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    revision: input.revision ?? (existing ? existing.revision + 1 : 1),
    syncStatus: input.syncStatus ?? 'pending',
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    lastSyncError: input.syncStatus === 'synced' ? null : (existing?.lastSyncError ?? null),
    // A deleted canvas stays deleted — an in-flight autosave must not resurrect it
    tombstoned: existing?.tombstoned ?? false,
    hasFig: true,
    hasThumb,
    figSize: input.figBytes.byteLength,
    lastOpenedAt: existing?.lastOpenedAt,
    ...writtenRevisions(input, existing)
  }
}

/** Meta row for an index-only upsert (remote canvas, no local fig). */
export function buildIndexMeta(
  input: LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
): LocalCanvasMeta {
  return {
    ...canvasIdentity(input, existing),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false,
    remoteRevision: input.remoteRevision ?? existing?.remoteRevision ?? null,
    conflictRevision: existing?.conflictRevision ?? null
  }
}
