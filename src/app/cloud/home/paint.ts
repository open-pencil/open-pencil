import { getLocalCanvasStore } from '@/app/cloud/local-store'
import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import {
  CloudCorsError,
  formatBrowserCorsHelpMessage,
  isLikelyCorsOrNetworkError
} from '@/app/cloud/s3/cors'
import { thumbnailBytesToObjectUrl } from '@/app/cloud/thumbnail'
import type { CloudCanvas } from '@/app/cloud/types'
import { isTauri } from '@/app/tauri/env'

export function revokeThumbnailUrls(list: CloudCanvas[]) {
  for (const canvas of list) {
    const url = canvas.thumbnailUrl
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}

export function metaToCanvas(
  meta: LocalCanvasMeta,
  thumbnailUrl: string | null = null
): CloudCanvas {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    thumbnailUrl,
    syncStatus: meta.syncStatus
  }
}

export function reconcileErrorMessage(e: unknown): string {
  const isCors = e instanceof CloudCorsError || (!isTauri() && isLikelyCorsOrNetworkError(e))
  if (isCors) return formatBrowserCorsHelpMessage()
  return e instanceof Error ? e.message : String(e)
}

export async function paintFromLocal(): Promise<CloudCanvas[]> {
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
      } catch (error) {
        console.warn('[Cloud] local thumbnail read failed:', meta.id, error)
      }
    }
    list.push(metaToCanvas(meta, thumbnailUrl))
  }
  return list
}
