import { createIdbLocalCanvasStore } from '@/app/cloud/local-store/idb'
import { createMemoryLocalCanvasStore } from '@/app/cloud/local-store/memory'
import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/cloud/local-store/types'

export type LocalCanvasStore = {
  listMetas(includeTombstones?: boolean): Promise<LocalCanvasMeta[]>
  getMeta(id: string): Promise<LocalCanvasMeta | null>
  readFig(id: string): Promise<Uint8Array | null>
  readThumb(id: string): Promise<Uint8Array | null>
  writeCanvas(input: LocalCanvasWriteInput): Promise<LocalCanvasMeta>
  /** Index-only row for remote canvases not yet downloaded (no fig body). */
  upsertIndexMeta(
    meta: Omit<LocalCanvasMeta, 'hasFig' | 'hasThumb' | 'tombstoned' | 'revision'> & {
      revision?: number
      hasFig?: boolean
      hasThumb?: boolean
    }
  ): Promise<LocalCanvasMeta>
  writeThumb(id: string, thumbBytes: Uint8Array): Promise<LocalCanvasMeta | null>
  updateMeta(id: string, patch: Partial<LocalCanvasMeta>): Promise<LocalCanvasMeta | null>
  tombstone(id: string): Promise<LocalCanvasMeta | null>
  remove(id: string): Promise<void>
  clearAll(): Promise<void>
}

let singleton: LocalCanvasStore | null = null
let usingMemoryFallback = false

export function isLocalCanvasStoreMemoryFallback(): boolean {
  return usingMemoryFallback
}

/** Reset singleton (tests). */
export function resetLocalCanvasStoreForTests(store?: LocalCanvasStore) {
  singleton = store ?? null
  usingMemoryFallback = false
}

/**
 * Process-wide local canvas store.
 * Prefers IndexedDB; falls back to memory (logged) if IDB is unavailable.
 */
export function getLocalCanvasStore(): LocalCanvasStore {
  if (singleton) return singleton
  try {
    if (typeof indexedDB !== 'undefined') {
      singleton = createIdbLocalCanvasStore()
      usingMemoryFallback = false
      return singleton
    }
  } catch (error) {
    console.warn('[Cloud] IndexedDB local store unavailable, using memory:', error)
  }
  singleton = createMemoryLocalCanvasStore()
  usingMemoryFallback = true
  return singleton
}
