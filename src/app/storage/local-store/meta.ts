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

function sourceMeta(
  input: Pick<LocalCanvasWriteInput, 'id' | 'providerId' | 'connectionId' | 'workspaceId' | 'name'>,
  existing: LocalCanvasMeta | null
) {
  return {
    id: input.id,
    providerId: input.providerId,
    connectionId: input.connectionId ?? existing?.connectionId,
    workspaceId: input.workspaceId ?? existing?.workspaceId,
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
    ...sourceMeta(input, existing),
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
    remoteRevisionId: existing?.remoteRevisionId,
    lastOpenedAt: existing?.lastOpenedAt
  }
}

/** Meta row for an index-only upsert (remote canvas, no local fig). */
export function buildIndexMeta(
  input: LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
): LocalCanvasMeta {
  return {
    ...sourceMeta(input, existing),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false,
    remoteRevisionId: input.remoteRevisionId ?? existing?.remoteRevisionId
  }
}
