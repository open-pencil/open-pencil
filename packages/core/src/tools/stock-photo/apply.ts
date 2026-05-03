import type { FigmaAPI } from '#core/figma-api'
import type { StockPhotoProvider, StockPhotoResult } from './providers'

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

export async function applyPhoto(
  figma: FigmaAPI,
  provider: StockPhotoProvider,
  req: PhotoRequest
): Promise<PhotoResult> {
  const node = figma.getNodeById(req.id)
  if (!node) return { id: req.id, error: 'Not found' }

  const children = 'children' in node ? (node as { children: unknown[] }).children : []
  if (children.length > 0) {
    return { id: req.id, error: `"${node.name}" has children — use a leaf shape` }
  }

  const perPage = Math.min((req.index ?? 0) + 3, 15)
  const orientation = req.orientation ?? 'landscape'
  const targetDim = Math.max(node.width, node.height)

  let results: StockPhotoResult[]
  try {
    results = await provider.search(req.query, { perPage, orientation, targetDim })
  } catch (err) {
    return { id: req.id, error: err instanceof Error ? err.message : String(err) }
  }

  if (results.length === 0) return { id: req.id, error: `No photos for "${req.query}"` }
  const photo = results[Math.min(req.index ?? 0, results.length - 1)]

  let imageBytes: Uint8Array
  try {
    const response = await fetch(photo.url)
    if (!response.ok) return { id: req.id, error: `Download ${response.status}` }
    imageBytes = new Uint8Array(await response.arrayBuffer())
  } catch (err) {
    return { id: req.id, error: `Download: ${err instanceof Error ? err.message : String(err)}` }
  }

  const image = figma.createImage(imageBytes)
  node.fills = [
    {
      type: 'IMAGE',
      color: { r: 1, g: 1, b: 1, a: 1 },
      imageHash: image.hash,
      imageScaleMode: 'FILL',
      visible: true,
      opacity: 1
    }
  ]

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
}
