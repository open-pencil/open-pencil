import type { Editor } from '@open-pencil/core/editor'

import { beginCloudActivity } from '@/app/cloud/activity'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import { enqueuePutCanvas, enqueuePutThumb, kickSyncEngine } from '@/app/cloud/sync/engine'
import {
  encodeThumbnailJpeg,
  extractFigThumbnailPng,
  renderBlankCanvasThumbnailJpeg,
  renderGraphThumbnailPng
} from '@/app/cloud/thumbnail'
import type { CloudProviderId } from '@/app/cloud/types'

/**
 * Local-first save: write fig to device, mark pending, enqueue remote put.
 * Thumbnail is generated asynchronously and enqueued separately.
 */
export async function persistCloudCanvasLocally(options: {
  providerId: CloudProviderId
  canvasId: string
  name: string
  figBytes: Uint8Array
  editor?: Pick<Editor, 'graph' | 'renderer'> | null
  pageId?: string | null
  /** Show soft activity while writing local (optional). */
  activityMessage?: string | null
}): Promise<{ revision: number }> {
  const store = getLocalCanvasStore()
  const activity = options.activityMessage ? beginCloudActivity(options.activityMessage) : null

  try {
    const meta = await store.writeCanvas({
      id: options.canvasId,
      providerId: options.providerId,
      name: options.name,
      figBytes: options.figBytes,
      syncStatus: 'pending'
    })
    await enqueuePutCanvas(options.canvasId, meta.revision)

    // Thumb off the critical path — never fails the save.
    void generateAndEnqueueThumb({
      canvasId: options.canvasId,
      revision: meta.revision,
      figBytes: options.figBytes,
      editor: options.editor,
      pageId: options.pageId
    })

    return { revision: meta.revision }
  } finally {
    activity?.end()
  }
}

async function generateAndEnqueueThumb(options: {
  canvasId: string
  revision: number
  figBytes: Uint8Array
  editor?: Pick<Editor, 'graph' | 'renderer'> | null
  pageId?: string | null
}): Promise<void> {
  try {
    let png: Uint8Array | null = null
    if (options.editor?.graph) {
      png = renderGraphThumbnailPng({
        graph: options.editor.graph,
        pageId: options.pageId,
        renderer: options.editor.renderer,
        ck: options.editor.renderer?.ck
      })
    }
    if (!png || png.byteLength < 256) {
      png = extractFigThumbnailPng(options.figBytes)
    }
    let jpeg: Uint8Array | null = null
    if (png && png.byteLength >= 256) {
      jpeg = await encodeThumbnailJpeg(png)
    } else {
      jpeg = await renderBlankCanvasThumbnailJpeg()
    }
    if (!jpeg || jpeg.byteLength === 0) return
    await getLocalCanvasStore().writeThumb(options.canvasId, jpeg)
    await enqueuePutThumb(options.canvasId, options.revision)
    void kickSyncEngine()
  } catch (error) {
    console.warn('[Cloud] Local thumb generation failed:', error)
  }
}

/** Seed local cache from remote bytes (open miss / reconcile). */
export async function seedLocalCanvasFromRemote(options: {
  providerId: CloudProviderId
  canvasId: string
  name: string
  updatedAt: string
  figBytes: Uint8Array
  thumbBytes?: Uint8Array | null
  markSynced?: boolean
}): Promise<void> {
  await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    updatedAt: options.updatedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbBytes,
    syncStatus: options.markSynced === false ? 'pending' : 'synced'
  })
  if (options.markSynced !== false) {
    await getLocalCanvasStore().updateMeta(options.canvasId, {
      lastSyncedAt: options.updatedAt || new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncError: null
    })
  }
}
