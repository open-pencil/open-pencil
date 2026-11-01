import { createIdbLocalCanvasStore } from '@/app/storage/local-store/idb'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasState,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'

export type UpdateLocalCanvasMetaOptions = {
  /** Apply only if the row still has this revision. */
  expectedRevision?: number
}

export type RemoveLocalCanvasOptions = {
  /** Remove only if the row is still in this state, checked in the same transaction. */
  unchangedFrom?: LocalCanvasState
}

export type LocalCanvasStore = {
  listMetas(includeTombstones?: boolean): Promise<LocalCanvasMeta[]>
  getMeta(id: string): Promise<LocalCanvasMeta | null>
  readFig(id: string): Promise<Uint8Array | null>
  readThumb(id: string): Promise<Uint8Array | null>
  writeCanvas(input: LocalCanvasWriteInput): Promise<LocalCanvasMeta>
  /** Index-only row for remote canvases not yet downloaded (no fig body). */
  upsertIndexMeta(meta: LocalCanvasIndexInput): Promise<LocalCanvasMeta>
  writeThumb(id: string, thumbBytes: Uint8Array): Promise<LocalCanvasMeta | null>
  updateMeta(
    id: string,
    patch: Partial<LocalCanvasMeta>,
    options?: UpdateLocalCanvasMetaOptions
  ): Promise<LocalCanvasMeta | null>
  tombstone(id: string): Promise<LocalCanvasMeta | null>
  /** Drop only the cached fig blob (eviction) — meta and thumb stay. */
  clearFig(id: string): Promise<LocalCanvasMeta | null>
  /** Removes the copy, and says whether it did; a changed row stays under `unchangedFrom`. */
  remove(id: string, options?: RemoveLocalCanvasOptions): Promise<boolean>
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
    console.warn('[Storage] IndexedDB local store unavailable, using memory:', error)
  }
  singleton = createMemoryLocalCanvasStore()
  usingMemoryFallback = true
  return singleton
}
