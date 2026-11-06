import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { storeImage } from '#core/figma-api/images'
import type { FigmaNodeProxy } from '#core/figma-api/proxy'

import type { StockPhotoProvider, StockPhotoResult } from './providers'

const STOCK_PHOTO_TARGET_TYPES: ReadonlySet<FigmaNodeProxy['type']> = new Set([
  'FRAME',
  'SLOT',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'STAR',
  'POLYGON',
  'VECTOR',
  'BOOLEAN_OPERATION',
  'COMPONENT',
  'INSTANCE'
])

export interface PhotoRequest {
  id: string
  query: string
  index?: number
  orientation?: 'landscape' | 'portrait' | 'square'
}

export interface PhotoResult {
  id: string
  photo?: {
    sourceId: string
    photographer: string
    width: number
    height: number
    provider: string
  }
  error?: string
}

type Download = { request: PhotoRequest; photo: StockPhotoResult; bytes: Uint8Array }

/** Finds and downloads the photo `request` asks for, writing nothing. */
async function downloadPhoto(
  figma: FigmaAPI,
  provider: StockPhotoProvider,
  request: PhotoRequest
): Promise<Download | PhotoResult> {
  const node = figma.getNodeById(request.id)
  if (!node) return { id: request.id, error: 'Not found' }

  if (!STOCK_PHOTO_TARGET_TYPES.has(node.type)) {
    return {
      id: request.id,
      error: `"${node.name}" (${node.type}) is not a suitable stock photo target`
    }
  }

  if (node.type === 'VECTOR' && (node.vectorNetwork.regions?.length ?? 0) === 0) {
    return {
      id: request.id,
      error: `"${node.name}" has no closed vector regions — use closed area geometry`
    }
  }

  if (node.type !== 'BOOLEAN_OPERATION' && node.children.length > 0) {
    return { id: request.id, error: `"${node.name}" has children — use a leaf image placeholder` }
  }

  const perPage = Math.min((request.index ?? 0) + 3, 15)
  const orientation = request.orientation ?? 'landscape'
  const targetDim = Math.max(node.width, node.height)

  let results: StockPhotoResult[]
  try {
    results = await provider.search(request.query, { perPage, orientation, targetDim })
  } catch (err) {
    return { id: request.id, error: err instanceof Error ? err.message : String(err) }
  }

  if (results.length === 0) return { id: request.id, error: `No photos for "${request.query}"` }
  const photo = results[Math.min(request.index ?? 0, results.length - 1)]

  try {
    const response = await fetch(photo.url)
    if (!response.ok) return { id: request.id, error: `Download ${response.status}` }
    return { request, photo, bytes: new Uint8Array(await response.arrayBuffer()) }
  } catch (err) {
    return {
      id: request.id,
      error: `Download: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * Downloads a photo for each request, then fills each target with its photo. The downloads run
 * outside the edit (`SceneGraph.waitOutsideEdit`), so all its writes come together after them.
 */
export async function applyPhotos(
  figma: FigmaAPI,
  provider: StockPhotoProvider,
  requests: PhotoRequest[]
): Promise<PhotoResult[]> {
  const downloads = await graphOf(figma).waitOutsideEdit(
    Promise.all(requests.map((request) => downloadPhoto(figma, provider, request)))
  )
  const applied: StockPhotoResult[] = []
  const results = downloads.map((download): PhotoResult => {
    if (!('bytes' in download)) return download
    const { request, photo, bytes } = download
    // Someone else may have removed the target while the photo downloaded.
    const node = figma.getNodeById(request.id)
    if (!node) return { id: request.id, error: 'Not found' }
    node.fills = [
      { type: 'IMAGE', imageHash: storeImage(graphOf(figma), bytes), scaleMode: 'FILL' }
    ]
    applied.push(photo)
    return {
      id: node.id,
      photo: {
        sourceId: photo.sourceId,
        photographer: photo.photographer,
        width: photo.width,
        height: photo.height,
        provider: provider.name
      }
    }
  })
  // A missed report does not undo the photo the document already shows.
  await graphOf(figma).waitOutsideEdit(
    Promise.allSettled(applied.map(async (photo) => provider.reportUse?.(photo)))
  )
  return results
}
