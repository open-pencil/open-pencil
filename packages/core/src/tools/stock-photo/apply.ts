import type { FigmaAPI } from '#core/figma-api'

import type { StockPhotoProvider, StockPhotoResult } from './providers'

export interface PhotoRequest {
  id: string
  query: string
  index?: number
  orientation?: 'landscape' | 'portrait' | 'square'
}

interface NodeWithChildren {
  children: unknown[]
}

interface CoverLikeNode {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  parent?: unknown
}

const CONTAINER_FILL_NAMES = /\b(background|bg|cover|hero|banner|header|photo\s*holder)\b/iu

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

function bytesFromDataUrl(url: string): Uint8Array | null {
  const match = url.match(/^data:([^,]*),(.+)$/u)
  if (!match) return null
  const isBase64 = match[1]?.includes(';base64')
  const payload = match[2] ?? ''
  if (!isBase64) return new TextEncoder().encode(decodeURIComponent(payload))
  const binary = atob(payload)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function isImageFillTarget(type: string): boolean {
  return (
    type === 'RECTANGLE' ||
    type === 'ELLIPSE' ||
    type === 'FRAME' ||
    type === 'COMPONENT' ||
    type === 'INSTANCE'
  )
}

function fitCoverLikeNodeToParent(figma: FigmaAPI, node: CoverLikeNode) {
  if (!CONTAINER_FILL_NAMES.test(node.name)) return
  const parent = node.parent
  if (
    !parent ||
    typeof parent !== 'object' ||
    !('width' in parent) ||
    !('height' in parent) ||
    typeof parent.width !== 'number' ||
    typeof parent.height !== 'number'
  ) {
    return
  }

  if (node.width >= parent.width && node.height >= parent.height) return
  const liveNode = figma.getNodeById(node.id)
  if (!liveNode) return
  liveNode.x = 0
  liveNode.y = 0
  liveNode.resize(parent.width, parent.height)
}

export async function applyPhoto(
  figma: FigmaAPI,
  provider: StockPhotoProvider,
  req: PhotoRequest
): Promise<PhotoResult> {
  const node = figma.getNodeById(req.id)
  if (!node) return { id: req.id, error: 'Not found' }
  if (!isImageFillTarget(node.type)) {
    return { id: req.id, error: `"${node.name}" is ${node.type}; use a shape for image fills` }
  }

  const children = 'children' in node ? (node as NodeWithChildren).children : []
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
    const dataUrlBytes = bytesFromDataUrl(photo.url)
    if (dataUrlBytes) {
      imageBytes = dataUrlBytes
    } else {
      const response = await fetch(photo.url)
      if (!response.ok) return { id: req.id, error: `Download ${response.status}` }
      imageBytes = new Uint8Array(await response.arrayBuffer())
    }
  } catch (err) {
    return { id: req.id, error: `Download: ${err instanceof Error ? err.message : String(err)}` }
  }

  const image = figma.createImage(imageBytes)
  fitCoverLikeNodeToParent(figma, node)
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
