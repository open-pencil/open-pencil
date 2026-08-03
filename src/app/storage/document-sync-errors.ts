import { ref, watch, type Ref } from 'vue'

import type { StorageProviderID } from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import { syncHasFailure } from '@/app/storage/sync'

/**
 * Per-document failure text, split by layer.
 *
 * The two are never merged: `thumbnail` is cosmetic and must not make a
 * perfectly synced document read as broken.
 */
export type DocumentSyncErrors = {
  body: string | null
  thumbnail: string | null
}

export type DocumentSyncErrorSource = {
  errors: Ref<Record<string, DocumentSyncErrors>>
  /** Adopt errors from rows the caller has already read — no second IDB pass. */
  setFrom(metas: LocalCanvasMeta[]): void
}

export function useDocumentSyncErrors(
  providerId: () => StorageProviderID
): DocumentSyncErrorSource {
  const errors = ref<Record<string, DocumentSyncErrors>>({})

  function setFrom(metas: LocalCanvasMeta[]): void {
    const next: Record<string, DocumentSyncErrors> = {}
    for (const metadata of metas) {
      if (!metadata.lastSyncError && !metadata.lastThumbSyncError) continue
      next[metadata.id] = { body: metadata.lastSyncError, thumbnail: metadata.lastThumbSyncError }
    }
    errors.value = next
  }

  async function reload(): Promise<void> {
    // Pin the provider across the await, or a slow read lands under whichever
    // provider is selected by the time it resolves.
    const target = providerId()
    const metas = await getLocalCanvasStore().listMetas(true)
    if (target !== providerId()) return
    setFrom(metas.filter((metadata) => metadata.syncTargetId === target))
  }

  /**
   * Re-read when the engine enters or leaves a failure state.
   *
   * The store has no change feed, so the alternative is polling. Keying on the
   * boolean means this runs on transitions only, not once per drained job.
   */
  watch(syncHasFailure, () => void reload())

  return { errors, setFrom }
}
