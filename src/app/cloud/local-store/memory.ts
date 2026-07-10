import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/cloud/local-store/types'
import type { LocalCanvasStore } from '@/app/cloud/local-store/store'

/** In-memory store for unit tests and environments without IndexedDB. */
export function createMemoryLocalCanvasStore(): LocalCanvasStore {
  const metas = new Map<string, LocalCanvasMeta>()
  const figs = new Map<string, Uint8Array>()
  const thumbs = new Map<string, Uint8Array>()

  return {
    async listMetas(includeTombstones = false) {
      const all = [...metas.values()]
      const filtered = includeTombstones ? all : all.filter((m) => !m.tombstoned)
      return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async getMeta(id: string) {
      return metas.get(id) ?? null
    },

    async readFig(id: string) {
      const bytes = figs.get(id)
      return bytes ? new Uint8Array(bytes) : null
    },

    async readThumb(id: string) {
      const bytes = thumbs.get(id)
      return bytes ? new Uint8Array(bytes) : null
    },

    async writeCanvas(input: LocalCanvasWriteInput) {
      const existing = metas.get(input.id)
      const revision = input.revision ?? (existing ? existing.revision + 1 : 1)
      const figCopy = new Uint8Array(input.figBytes)
      figs.set(input.id, figCopy)

      let hasThumb = existing?.hasThumb ?? false
      if (input.thumbBytes != null) {
        if (input.thumbBytes.byteLength > 0) {
          thumbs.set(input.id, new Uint8Array(input.thumbBytes))
          hasThumb = true
        } else {
          thumbs.delete(input.id)
          hasThumb = false
        }
      }

      const meta: LocalCanvasMeta = {
        id: input.id,
        providerId: input.providerId,
        name: input.name,
        updatedAt: input.updatedAt ?? new Date().toISOString(),
        revision,
        syncStatus: input.syncStatus ?? 'pending',
        lastSyncedAt: existing?.lastSyncedAt ?? null,
        lastSyncError: input.syncStatus === 'synced' ? null : (existing?.lastSyncError ?? null),
        tombstoned: false,
        hasFig: true,
        hasThumb
      }
      metas.set(input.id, meta)
      return meta
    },

    async upsertIndexMeta(input) {
      const existing = metas.get(input.id)
      const meta: LocalCanvasMeta = {
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
      metas.set(input.id, meta)
      return meta
    },

    async writeThumb(id: string, thumbBytes: Uint8Array) {
      const existing = metas.get(id)
      if (!existing) return null
      thumbs.set(id, new Uint8Array(thumbBytes))
      const meta: LocalCanvasMeta = {
        ...existing,
        hasThumb: true,
        syncStatus: existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus
      }
      metas.set(id, meta)
      return meta
    },

    async updateMeta(id: string, patch: Partial<LocalCanvasMeta>) {
      const existing = metas.get(id)
      if (!existing) return null
      const next = { ...existing, ...patch, id: existing.id }
      metas.set(id, next)
      return next
    },

    async tombstone(id: string) {
      const existing = metas.get(id)
      if (!existing) return null
      const next: LocalCanvasMeta = {
        ...existing,
        tombstoned: true,
        syncStatus: 'pending',
        updatedAt: new Date().toISOString()
      }
      metas.set(id, next)
      return next
    },

    async remove(id: string) {
      metas.delete(id)
      figs.delete(id)
      thumbs.delete(id)
    },

    async clearAll() {
      metas.clear()
      figs.clear()
      thumbs.clear()
    }
  }
}
