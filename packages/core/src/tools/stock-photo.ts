import { defineTool } from './schema'

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

function pickSize(
  src: PexelsPhoto['src'],
  targetWidth: number
): string {
  if (targetWidth <= 200) return src.small
  if (targetWidth <= 400) return src.medium
  if (targetWidth <= 800) return src.large
  if (targetWidth <= 1600) return src.large2x
  return src.original
}

export const stockPhoto = defineTool({
  name: 'stock_photo',
  mutates: true,
  description:
    'Search Pexels for a stock photo and apply it as an image fill on a node. Use descriptive English search queries. Requires Pexels API key in settings.',
  params: {
    id: { type: 'string', description: 'Node ID to apply the photo to', required: true },
    query: { type: 'string', description: 'Search query (English, descriptive, e.g. "business meeting office")', required: true },
    index: { type: 'number', description: 'Which result to use (0-based, default 0)', default: 0 },
    orientation: {
      type: 'string',
      description: 'Photo orientation',
      enum: ['landscape', 'portrait', 'square'],
      default: 'landscape'
    }
  },
  execute: async (figma, { id, query, index, orientation }) => {
    if (!pexelsApiKey) {
      return { error: 'Pexels API key not configured. Ask the user to add it in AI chat settings.' }
    }

    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const perPage = Math.min((index ?? 0) + 3, 15)
    const orient = orientation ?? 'landscape'
    const url = `${PEXELS_BASE}/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orient}`

    let data: PexelsSearchResponse
    try {
      const response = await fetch(url, {
        headers: { Authorization: pexelsApiKey }
      })
      if (!response.ok) {
        return { error: `Pexels API error: ${response.status} ${response.statusText}` }
      }
      data = await response.json() as PexelsSearchResponse
    } catch (err) {
      return { error: `Pexels API request failed: ${err instanceof Error ? err.message : String(err)}` }
    }

    if (data.photos.length === 0) {
      return { error: `No photos found for "${query}"` }
    }

    const photoIndex = Math.min(index ?? 0, data.photos.length - 1)
    const photo = data.photos[photoIndex]
    const imageUrl = pickSize(photo.src, Math.max(node.width, node.height))

    let imageBytes: Uint8Array
    try {
      const imgResponse = await fetch(imageUrl)
      if (!imgResponse.ok) {
        return { error: `Failed to download photo: ${imgResponse.status}` }
      }
      imageBytes = new Uint8Array(await imgResponse.arrayBuffer())
    } catch (err) {
      return { error: `Photo download failed: ${err instanceof Error ? err.message : String(err)}` }
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
      photo: {
        pexelsId: photo.id,
        photographer: photo.photographer,
        width: photo.width,
        height: photo.height
      }
    }
  }
})
