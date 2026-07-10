import { buildIndexMeta, buildWriteMeta, sortAndFilterMetas } from '@/app/cloud/local-store/meta'
import type { LocalCanvasStore } from '@/app/cloud/local-store/store'
import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/cloud/local-store/types'

/** In-memory store for unit tests and environments without IndexedDB. */
export function createMemoryLocalCanvasStore(): LocalCanvasStore {
  const metas = new Map<string, LocalCanvasMeta>()
  const figs = new Map<string, Uint8Array>()
  const thumbs = new Map<string, Uint8Array>()

  return {
    async listMetas(includeTombstones = false) {
      return sortAndFilterMetas([...metas.values()], includeTombstones)
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
      const existing = metas.get(input.id) ?? null
      figs.set(input.id, new Uint8Array(input.figBytes))

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

      const meta = buildWriteMeta(input, existing, hasThumb)
      metas.set(input.id, meta)
      return meta
    },

    async upsertIndexMeta(input) {
      const meta = buildIndexMeta(input, metas.get(input.id) ?? null)
      metas.set(input.id, meta)
      return meta
    },

    async writeThumb(id: string, thumbBytes: Uint8Array) {
      const existing = metas.get(id)
      if (!existing) return null
      thumbs.set(id, new Uint8Array(thumbBytes))
      // Thumb freshness is tracked by its own outbox job — never demote the
      // document's syncStatus here (it orphaned rows as 'pending' forever).
      const meta: LocalCanvasMeta = {
        ...existing,
        hasThumb: true
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

    async clearFig(id: string) {
      const existing = metas.get(id)
      if (!existing) return null
      figs.delete(id)
      const meta: LocalCanvasMeta = { ...existing, hasFig: false, figSize: 0 }
      metas.set(id, meta)
      return meta
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
