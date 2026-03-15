import { defineTool } from './schema'

import type { FigmaAPI } from '../figma-api'

export interface StockPhotoResult {
  url: string
  width: number
  height: number
  photographer: string
  sourceId: string
}

export interface StockPhotoProvider {
  name: string
  search(query: string, options: {
    perPage: number
    orientation: 'landscape' | 'portrait' | 'square'
    targetDim: number
  }): Promise<StockPhotoResult[]>
}

const providers = new Map<string, StockPhotoProvider>()
let activeProviderId: string | null = null

export function registerStockPhotoProvider(provider: StockPhotoProvider): void {
  providers.set(provider.name, provider)
  if (!activeProviderId) activeProviderId = provider.name
}

export function setActiveStockPhotoProvider(name: string | null): void {
  activeProviderId = name
}

export function getStockPhotoProviders(): string[] {
  return [...providers.keys()]
}

function getActiveProvider(): StockPhotoProvider | null {
  if (!activeProviderId) return null
  return providers.get(activeProviderId) ?? null
}

// --- Pexels provider ---

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

function pickPexelsSize(src: PexelsPhoto['src'], targetDim: number): string {
  if (targetDim <= 200) return src.small
  if (targetDim <= 400) return src.medium
  if (targetDim <= 800) return src.large
  if (targetDim <= 1600) return src.large2x
  return src.original
}

let pexelsApiKey: string | null = null

export function setPexelsApiKey(key: string | null): void {
  pexelsApiKey = key
  if (key) {
    registerStockPhotoProvider(pexelsProvider)
    setActiveStockPhotoProvider('pexels')
  }
}

const pexelsProvider: StockPhotoProvider = {
  name: 'pexels',
  async search(query, { perPage, orientation, targetDim }) {
    if (!pexelsApiKey) throw new Error('Pexels API key not configured')
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`
    const resp = await fetch(url, { headers: { Authorization: pexelsApiKey } })
    if (!resp.ok) throw new Error(`Pexels ${resp.status}`)
    const data = (await resp.json()) as { photos: PexelsPhoto[] }
    return data.photos.map((p) => ({
      url: pickPexelsSize(p.src, targetDim),
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      sourceId: String(p.id)
    }))
  }
}

// --- Unsplash provider ---

let unsplashAccessKey: string | null = null

export function setUnsplashAccessKey(key: string | null): void {
  unsplashAccessKey = key
  if (key) {
    registerStockPhotoProvider(unsplashProvider)
  }
}

interface UnsplashPhoto {
  id: string
  width: number
  height: number
  urls: { raw: string; full: string; regular: string; small: string; thumb: string }
  user: { name: string }
  links: { download_location: string }
}

function pickUnsplashSize(urls: UnsplashPhoto['urls'], targetDim: number): string {
  if (targetDim <= 200) return urls.thumb
  if (targetDim <= 400) return urls.small
  if (targetDim <= 1080) return urls.regular
  return urls.full
}

const unsplashProvider: StockPhotoProvider = {
  name: 'unsplash',
  async search(query, { perPage, orientation }) {
    if (!unsplashAccessKey) throw new Error('Unsplash access key not configured')
    const orient = orientation === 'square' ? 'squarish' : orientation
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orient}`
    const resp = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${unsplashAccessKey}`,
        'Accept-Version': 'v1'
      }
    })
    if (!resp.ok) throw new Error(`Unsplash ${resp.status}`)
    const data = (await resp.json()) as { results: UnsplashPhoto[] }
    return data.results.map((p) => ({
      url: pickUnsplashSize(p.urls, 1080),
      width: p.width,
      height: p.height,
      photographer: p.user.name,
      sourceId: p.id
    }))
  }
}

// --- Tool ---

interface PhotoRequest {
  id: string
  query: string
  index?: number
  orientation?: 'landscape' | 'portrait' | 'square'
}

interface PhotoResult {
  id: string
  photo?: { sourceId: string; photographer: string; width: number; height: number; provider: string }
  error?: string
}

async function applyPhoto(
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
    const imgResp = await fetch(photo.url)
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
    photo: {
      sourceId: photo.sourceId,
      photographer: photo.photographer,
      width: photo.width,
      height: photo.height,
      provider: provider.name
    }
  }
}

export const stockPhoto = defineTool({
  name: 'stock_photo',
  mutates: true,
  description:
    'Search stock photos and apply to nodes. Pass a JSON array — all fetched in parallel. ' +
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
    const provider = getActiveProvider()
    if (!provider) {
      return {
        error: `No stock photo provider configured. Ask the user to add an API key in AI chat settings. Available providers: Pexels, Unsplash.`
      }
    }

    let reqs: PhotoRequest[]
    try {
      const parsed = JSON.parse(String(requests))
      reqs = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return { error: 'Invalid JSON in requests' }
    }

    if (reqs.length === 0) return { error: 'Empty requests array' }

    const results = await Promise.all(reqs.map((r) => applyPhoto(figma, provider, r)))
    const ok = results.filter((r) => r.photo).length

    return { applied: ok, failed: results.length - ok, provider: provider.name, results }
  }
})
