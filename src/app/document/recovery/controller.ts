import { watchDebounced } from '@vueuse/core'
import type { WatchHandle } from 'vue'

import type { EditorState } from '@open-pencil/core/editor'

import { getRecoveryStore } from '@/app/document/recovery/store'
import type { RecoveryStore } from '@/app/document/recovery/types'
import { createCanvasId } from '@/app/storage/id'

type RecoveryState = EditorState & { documentName: string }

interface DocumentRecoveryOptions {
  state: RecoveryState
  buildFigFile: () => Promise<Uint8Array> | Uint8Array
  hasWritableSource: () => boolean
  store?: RecoveryStore
  recoveryId?: string
}

export interface DocumentRecoveryController {
  getRecoveryId(): string
  adoptRecoverySnapshot(id: string, sceneVersion: number): Promise<void>
  persistNow(): Promise<void>
  markProtectedVersion(version: number): Promise<void>
  discardRecovery(): Promise<void>
  disposeRecovery(): void
}

export function createDocumentRecovery({
  state,
  buildFigFile,
  hasWritableSource,
  store = getRecoveryStore(),
  recoveryId = createCanvasId()
}: DocumentRecoveryOptions): DocumentRecoveryController {
  let id = recoveryId
  let protectedVersion = state.sceneVersion
  let persistedVersion: number | null = null
  let requestedVersion = protectedVersion
  let lifecycleGeneration = 0
  let writing: Promise<void> | null = null
  let disposed = false

  async function runWrites(generation: number): Promise<void> {
    if (disposed || generation !== lifecycleGeneration) return
    if (hasWritableSource() || requestedVersion === protectedVersion) return
    const version = requestedVersion
    const bytes = await buildFigFile()
    if (generation !== lifecycleGeneration || hasWritableSource()) return
    await store.write({
      id,
      documentName: state.documentName,
      sceneVersion: version,
      figBytes: bytes
    })
    persistedVersion = version
    if (generation !== lifecycleGeneration) return
    protectedVersion = version
    if (requestedVersion !== version) await runWrites(generation)
  }

  async function persistNow(): Promise<void> {
    if (disposed || hasWritableSource()) return
    requestedVersion = state.sceneVersion
    if (requestedVersion === protectedVersion) return
    if (!writing) {
      const generation = lifecycleGeneration
      writing = runWrites(generation).finally(() => {
        writing = null
      })
    }
    await writing
  }

  const stop: WatchHandle = watchDebounced(
    () => state.sceneVersion,
    () => {
      void persistNow().catch((error) => console.warn('[Recovery] Snapshot failed:', error))
    },
    { debounce: 3000, maxWait: 10000 }
  )

  async function invalidateActiveWrite(): Promise<void> {
    lifecycleGeneration++
    await writing
  }

  return {
    getRecoveryId: () => id,
    async adoptRecoverySnapshot(nextId, sceneVersion) {
      const previousId = id
      await invalidateActiveWrite()
      id = nextId
      protectedVersion = sceneVersion
      persistedVersion = sceneVersion
      requestedVersion = sceneVersion
      disposed = false
      if (previousId !== nextId) await store.remove(previousId)
    },
    persistNow,
    async markProtectedVersion(version) {
      await invalidateActiveWrite()
      protectedVersion = version
      requestedVersion = state.sceneVersion
      if (persistedVersion == null || persistedVersion <= version) {
        await store.remove(id)
        persistedVersion = null
      }
    },
    async discardRecovery() {
      await invalidateActiveWrite()
      protectedVersion = state.sceneVersion
      persistedVersion = null
      requestedVersion = state.sceneVersion
      await store.remove(id)
    },
    disposeRecovery() {
      disposed = true
      lifecycleGeneration++
      stop()
    }
  }
}
