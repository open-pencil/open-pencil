import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { getActiveCloudAdapter } from '@/app/cloud/active'
import { beginCloudActivity } from '@/app/cloud/activity'
import { cloudConnectionError } from '@/app/cloud/health'
import {
  deleteCloudCanvas,
  downloadCloudCanvas,
  duplicateCloudCanvas,
  renameCloudCanvas
} from '@/app/cloud/home/actions'
import {
  paintFromLocal,
  reconcileErrorMessage,
  revokeThumbnailUrls
} from '@/app/cloud/home/paint'
import { reconcileLocalMetas, reconcileRemoteEntries } from '@/app/cloud/home/reconcile'
import { applyLocalMetaToCanvases } from '@/app/cloud/home/sync-badges'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import {
  getOutbox,
  kickSyncEngine,
  pendingSyncCount,
  uploadProgressByCanvas
} from '@/app/cloud/sync'
import { thumbnailBytesToObjectUrl } from '@/app/cloud/thumbnail'
import type { CloudCanvas } from '@/app/cloud/types'
import { maybeSeedWelcomeProject } from '@/app/cloud/welcome-seed'

export type CloudHomePhase = 'idle' | 'connecting' | 'listing' | 'done' | 'error'
export { applyLocalMetaToCanvases } from '@/app/cloud/home/sync-badges'

export function useCloudHome() {
  const canvases = ref<CloudCanvas[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const phase = ref<CloudHomePhase>('idle')
  const syncWarning = ref<string | null>(null)
  let thumbLoadGeneration = 0

  const statusMessage = computed(() => {
    switch (phase.value) {
      case 'connecting':
        return 'Connecting to cloud storage…'
      case 'listing':
        return 'Loading your files…'
      case 'error':
        return error.value ?? 'Could not load files.'
      default:
        return loading.value ? 'Loading your files…' : null
    }
  })

  tryOnScopeDispose(() => {
    thumbLoadGeneration += 1
    revokeThumbnailUrls(canvases.value)
  })

  /**
   * After an outbox put finishes, IDB meta is 'synced' but the home grid still
   * holds the stale 'pending' snapshot from the last paintFromLocal — so the
   * blue progress fill clears while the "Syncing" badge sticks forever.
   * Re-read metas whenever upload progress or queue depth changes.
   */
  async function refreshSyncBadgesFromLocal() {
    if (canvases.value.length === 0) return
    try {
      const metas = await getLocalCanvasStore().listMetas(false)
      const next = applyLocalMetaToCanvases(canvases.value, metas)
      if (next !== canvases.value) canvases.value = next
    } catch (error) {
      console.warn('[Cloud] sync badge refresh failed:', error)
    }
  }

  watch(pendingSyncCount, () => {
    void refreshSyncBadgesFromLocal()
  })
  // Key set only — ignore 0..1 fraction ticks during the upload fill animation.
  watch(
    () => [...uploadProgressByCanvas.value.keys()].sort().join('\0'),
    () => {
      void refreshSyncBadgesFromLocal()
    }
  )

  async function hydrateMissingThumbs(list: CloudCanvas[]) {
    const adapter = getActiveCloudAdapter()
    const remoteThumbGetter = adapter?.getThumbnail?.bind(adapter)
    const local = getLocalCanvasStore()
    if (!remoteThumbGetter || list.length === 0) return
    // Narrowed alias — closures below can't see the guard above.
    const fetchRemoteThumb = remoteThumbGetter

    const generation = ++thumbLoadGeneration
    const concurrency = 4
    let index = 0

    async function worker() {
      while (index < list.length) {
        if (generation !== thumbLoadGeneration) return
        const i = index
        index += 1
        const canvas = list[i]
        if (canvas.thumbnailUrl) continue
        try {
          // Prefer local again (race with paint)
          const localThumb = await local.readThumb(canvas.id)
          let bytes = localThumb
          if (!bytes || bytes.byteLength === 0) {
            bytes = await fetchRemoteThumb(canvas.id)
            if (bytes && bytes.byteLength > 0) {
              await local.writeThumb(canvas.id, bytes)
            }
          }
          if (generation !== thumbLoadGeneration || !bytes || bytes.byteLength === 0) continue
          const url = thumbnailBytesToObjectUrl(bytes)
          if (generation !== thumbLoadGeneration) {
            URL.revokeObjectURL(url)
            continue
          }
          canvases.value = canvases.value.map((c) => {
            if (c.id !== canvas.id) return c
            if (c.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(c.thumbnailUrl)
            return { ...c, thumbnailUrl: url }
          })
        } catch (error) {
          // Keep the placeholder tile — thumbnails are cosmetic.
          console.warn('[Cloud] thumbnail hydrate failed:', canvas.id, error)
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()))
  }

  let reconcileGeneration = 0

  async function reconcileRemote() {
    const generation = ++reconcileGeneration
    const adapter = getActiveCloudAdapter()
    if (!adapter) return
    const local = getLocalCanvasStore()
    try {
      await adapter.ensureNamespace()
      const remote = await adapter.listCanvases()
      const localMetas = await local.listMetas(true)
      const localById = new Map(localMetas.map((m) => [m.id, m]))
      const remoteIds = new Set(remote.map((r) => r.id))
      const queuedIds = new Set((await getOutbox().list()).map((j) => j.canvasId))

      await reconcileRemoteEntries(adapter.id, remote, localById, queuedIds)
      await reconcileLocalMetas(localMetas, remoteIds, queuedIds)

      // A newer reconcile owns the UI (and the seed decision) from here on.
      if (generation !== reconcileGeneration) return
      syncWarning.value = null
      cloudConnectionError.value = null

      // Seed Welcome for a new bucket; recount post-reconcile (tombstones purged)
      const activeLocalCount = (await local.listMetas()).length
      if (await maybeSeedWelcomeProject(remote.length, activeLocalCount)) {
        void kickSyncEngine()
      }

      const painted = await paintFromLocal()
      if (generation !== reconcileGeneration) return
      revokeThumbnailUrls(canvases.value)
      canvases.value = painted
      void hydrateMissingThumbs(canvases.value)
      void kickSyncEngine()
    } catch (e) {
      if (generation !== reconcileGeneration) return
      syncWarning.value = reconcileErrorMessage(e)
      cloudConnectionError.value = syncWarning.value
    }
  }

  async function refresh() {
    const adapter = getActiveCloudAdapter()
    if (!adapter) {
      revokeThumbnailUrls(canvases.value)
      canvases.value = []
      error.value = null
      syncWarning.value = null
      cloudConnectionError.value = null
      phase.value = 'idle'
      return
    }

    loading.value = true
    error.value = null
    syncWarning.value = null
    phase.value = 'listing'
    const activity = beginCloudActivity('Loading your files…')

    try {
      // Instant local paint
      const localList = await paintFromLocal()
      revokeThumbnailUrls(canvases.value)
      canvases.value = localList
      phase.value = 'done'
      loading.value = false
      void hydrateMissingThumbs(canvases.value)

      // Background remote reconcile
      void reconcileRemote()
    } catch (e) {
      revokeThumbnailUrls(canvases.value)
      canvases.value = []
      phase.value = 'error'
      error.value = e instanceof Error ? e.message : String(e)
      loading.value = false
    } finally {
      activity.end()
    }
  }

  async function renameCanvas(id: string, name: string) {
    await renameCloudCanvas(id, name)
    await refresh()
  }

  async function duplicateCanvas(id: string) {
    await duplicateCloudCanvas(id)
    await refresh()
  }

  async function deleteCanvas(id: string) {
    await deleteCloudCanvas(id)
    await refresh()
  }

  return {
    canvases,
    loading,
    error,
    syncWarning,
    phase,
    statusMessage,
    refresh,
    renameCanvas,
    duplicateCanvas,
    downloadCanvas: downloadCloudCanvas,
    deleteCanvas
  }
}
