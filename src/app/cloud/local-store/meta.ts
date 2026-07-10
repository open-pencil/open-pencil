import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasWriteInput
} from '@/app/cloud/local-store/types'

/** Newest-first, tombstones hidden unless asked for. */
export function sortAndFilterMetas(
  all: LocalCanvasMeta[],
  includeTombstones: boolean
): LocalCanvasMeta[] {
  const filtered = includeTombstones ? all : all.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false
  }
}
