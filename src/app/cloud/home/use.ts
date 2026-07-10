import { computed, onUnmounted, ref } from 'vue'

import { getActiveCloudAdapter } from '@/app/cloud/active'
import { setCloudActivity } from '@/app/cloud/activity'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import {
  CloudCorsError,
  formatBrowserCorsHelpMessage,
  isLikelyCorsOrNetworkError
} from '@/app/cloud/s3/cors'
import { enqueueDeleteCanvas, enqueuePutCanvas, kickSyncEngine } from '@/app/cloud/sync'
import { thumbnailBytesToObjectUrl } from '@/app/cloud/thumbnail'
import type { CloudCanvas } from '@/app/cloud/types'
import { isTauri } from '@/app/tauri/env'

export type CloudHomePhase = 'idle' | 'connecting' | 'listing' | 'done' | 'error'

function revokeThumbnailUrls(list: CloudCanvas[]) {
  for (const canvas of list) {
    const url = canvas.thumbnailUrl
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}

function metaToCanvas(meta: LocalCanvasMeta, thumbnailUrl: string | null = null): CloudCanvas {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    thumbnailUrl,
    syncStatus: meta.syncStatus
  }
}

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

  onUnmounted(() => {
    thumbLoadGeneration += 1
    revokeThumbnailUrls(canvases.value)
  })

  async function paintFromLocal(): Promise<CloudCanvas[]> {
    const local = getLocalCanvasStore()
    const metas = await local.listMetas(false)
    const list: CloudCanvas[] = []
    for (const meta of metas) {
      let thumbnailUrl: string | null = null
      if (meta.hasThumb) {
        try {
          const thumb = await local.readThumb(meta.id)
          if (thumb && thumb.byteLength > 0) {
            thumbnailUrl = thumbnailBytesToObjectUrl(thumb)
          }
        } catch {
          // ignore
        }
      }
      list.push(metaToCanvas(meta, thumbnailUrl))
    }
    return list
  }

  async function hydrateMissingThumbs(list: CloudCanvas[]) {
    const adapter = getActiveCloudAdapter()
    const local = getLocalCanvasStore()
    if (!adapter?.getThumbnail || list.length === 0) return

    const generation = ++thumbLoadGeneration
    const concurrency = 4
    let index = 0

    async function worker() {
      while (index < list.length) {
        if (generation !== thumbLoadGeneration) return
        const i = index
        index += 1
        const canvas = list[i]
        if (!canvas || canvas.thumbnailUrl) continue
        try {
          // Prefer local again (race with paint)
          const localThumb = await local.readThumb(canvas.id)
          let bytes = localThumb
          if (!bytes || bytes.byteLength === 0) {
            bytes = await adapter!.getThumbnail!(canvas.id)
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
        } catch {
          // keep placeholder
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()))
  }

  async function reconcileRemote() {
    const adapter = getActiveCloudAdapter()
    if (!adapter) return
    const local = getLocalCanvasStore()
    try {
      await adapter.ensureNamespace()
      const remote = await adapter.listCanvases()
      const localMetas = await local.listMetas(true)
      const localById = new Map(localMetas.map((m) => [m.id, m]))
      const remoteIds = new Set(remote.map((r) => r.id))

      // Seed index rows for remote-only canvases (fig downloaded on open).
      for (const r of remote) {
        const existing = localById.get(r.id)
        if (existing?.tombstoned) continue
        if (!existing) {
          await local.upsertIndexMeta({
            id: r.id,
            providerId: adapter.id,
            name: r.name,
            updatedAt: r.updatedAt,
            syncStatus: 'synced',
            lastSyncedAt: r.updatedAt,
            lastSyncError: null,
            hasFig: false,
            hasThumb: false,
            revision: 1
          })
        } else if (
          existing.syncStatus === 'synced' &&
          r.updatedAt > existing.updatedAt &&
          !existing.tombstoned
        ) {
          await local.updateMeta(r.id, {
            name: r.name,
            updatedAt: r.updatedAt,
            hasFig: false // force re-download on next open
          })
        } else if (existing.syncStatus === 'synced' && r.name !== existing.name) {
          await local.updateMeta(r.id, { name: r.name })
        }
      }

      // Drop fully synced local-only that vanished remotely (not pending/error)
      for (const m of localMetas) {
        if (m.tombstoned) continue
        if (!remoteIds.has(m.id) && m.syncStatus === 'synced' && !m.hasFig) {
          await local.remove(m.id)
        }
      }

      syncWarning.value = null
      const painted = await paintFromLocal()
      revokeThumbnailUrls(canvases.value)
      canvases.value = painted
      void hydrateMissingThumbs(canvases.value)
      void kickSyncEngine()
    } catch (e) {
      const isCors =
        e instanceof CloudCorsError || (!isTauri() && isLikelyCorsOrNetworkError(e))
      syncWarning.value = isCors
        ? formatBrowserCorsHelpMessage()
        : e instanceof Error
          ? e.message
          : String(e)
    }
  }

  async function refresh() {
    const adapter = getActiveCloudAdapter()
    if (!adapter) {
      revokeThumbnailUrls(canvases.value)
      canvases.value = []
      error.value = null
      syncWarning.value = null
      phase.value = 'idle'
      setCloudActivity(null)
      return
    }

    loading.value = true
    error.value = null
    syncWarning.value = null
    phase.value = 'listing'
    setCloudActivity('Loading your files…')

    try {
      // Instant local paint
      const localList = await paintFromLocal()
      revokeThumbnailUrls(canvases.value)
      canvases.value = localList
      phase.value = 'done'
      loading.value = false
      setCloudActivity(null)
      void hydrateMissingThumbs(canvases.value)

      // Background remote reconcile
      void reconcileRemote()
    } catch (e) {
      revokeThumbnailUrls(canvases.value)
      canvases.value = []
      phase.value = 'error'
      error.value = e instanceof Error ? e.message : String(e)
      loading.value = false
      setCloudActivity(null)
    }
  }

  async function renameCanvas(id: string, name: string) {
    const adapter = getActiveCloudAdapter()
    if (!adapter) throw new Error('Cloud storage is not configured')
    const local = getLocalCanvasStore()
    const trimmed = name.trim() || 'Untitled'
    let fig = await local.readFig(id)
    if (!fig || fig.byteLength === 0) {
      fig = await adapter.getCanvas(id)
    }
    const meta = await local.writeCanvas({
      id,
      providerId: adapter.id,
      name: trimmed,
      figBytes: fig,
      syncStatus: 'pending'
    })
    await enqueuePutCanvas(id, meta.revision)
    void kickSyncEngine()
    await refresh()
  }

  async function deleteCanvas(id: string) {
    const adapter = getActiveCloudAdapter()
    if (!adapter) throw new Error('Cloud storage is not configured')
    await getLocalCanvasStore().tombstone(id)
    await enqueueDeleteCanvas(id)
    void kickSyncEngine()
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
    deleteCanvas
  }
}
