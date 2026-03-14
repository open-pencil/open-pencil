import { defineTool } from './schema'

import type { FigmaAPI } from '../figma-api'

const PEXELS_BASE = 'https://api.pexels.com'

interface PexelsPhoto {
  id: number
  width: number
  height: number
  photographer: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    landscape: string
  }
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[]
  total_results: number
}

let pexelsApiKey: string | null = null

export function setPexelsApiKey(key: string | null): void {
  pexelsApiKey = key
}

export function getPexelsApiKey(): string | null {
  return pexelsApiKey
}

function pickSize(src: PexelsPhoto['src'], targetDim: number): string {
  if (targetDim <= 200) return src.small
  if (targetDim <= 400) return src.medium
  if (targetDim <= 800) return src.large
  if (targetDim <= 1600) return src.large2x
  return src.original
}

interface PhotoRequest {
  id: string
  query: string
  index?: number
  orientation?: 'landscape' | 'portrait' | 'square'
}

interface PhotoResult {
  id: string
  photo?: { pexelsId: number; photographer: string; width: number; height: number }
  error?: string
}

async function applyPhoto(figma: FigmaAPI, req: PhotoRequest): Promise<PhotoResult> {
  const node = figma.getNodeById(req.id)
  if (!node) return { id: req.id, error: `Not found` }

  const children = 'children' in node ? (node as { children: unknown[] }).children : []
  if (children.length > 0) {
    return { id: req.id, error: `"${node.name}" has children — use a leaf shape` }
  }

  const perPage = Math.min((req.index ?? 0) + 3, 15)
  const orient = req.orientation ?? 'landscape'
  const url = `${PEXELS_BASE}/v1/search?query=${encodeURIComponent(req.query)}&per_page=${perPage}&orientation=${orient}`

  let data: PexelsSearchResponse
  try {
    const resp = await fetch(url, { headers: { Authorization: pexelsApiKey ?? '' } })
    if (!resp.ok) return { id: req.id, error: `Pexels ${resp.status}` }
    data = await resp.json() as PexelsSearchResponse
  } catch (err) {
    return { id: req.id, error: `Pexels: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (data.photos.length === 0) return { id: req.id, error: `No photos for "${req.query}"` }

  const photo = data.photos[Math.min(req.index ?? 0, data.photos.length - 1)]
  const imageUrl = pickSize(photo.src, Math.max(node.width, node.height))

  let imageBytes: Uint8Array
  try {
    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) return { id: req.id, error: `Download ${imgResp.status}` }
    imageBytes = new Uint8Array(await imgResp.arrayBuffer())
  } catch (err) {
    return { id: req.id, error: `Download: ${err instanceof Error ? err.message : String(err)}` }
  }

  const image = figma.createImage(imageBytes)
  node.fills = [{
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    imageHash: image.hash,
    imageScaleMode: 'FILL',
    visible: true,
    opacity: 1
  }]

  return {
    id: node.id,
    photo: { pexelsId: photo.id, photographer: photo.photographer, width: photo.width, height: photo.height }
  }
}

export const stockPhoto = defineTool({
  name: 'stock_photo',
  mutates: true,
  description:
    'Search Pexels and apply stock photos to nodes. Pass a JSON array — all fetched in parallel. ' +
    'Each item: {id, query, index?, orientation?}. Only works on leaf shapes (Rectangle/Ellipse).',
  params: {
    requests: {
      type: 'string',
      description:
        'JSON array: [{"id":"0:5","query":"mountain sunset"},{"id":"0:8","query":"business team","orientation":"square"}]',
      required: true
    }
  },
  execute: async (figma, { requests }) => {
    if (!pexelsApiKey) {
      return { error: 'Pexels API key not configured. Ask the user to add it in AI chat settings.' }
    }

    let reqs: PhotoRequest[]
    try {
      const parsed = JSON.parse(String(requests))
      reqs = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return { error: 'Invalid JSON in requests' }
    }

    if (reqs.length === 0) return { error: 'Empty requests array' }

    const results = await Promise.all(reqs.map((r) => applyPhoto(figma, r)))
    const ok = results.filter((r) => r.photo).length

    return { applied: ok, failed: results.length - ok, results }
  }
})
