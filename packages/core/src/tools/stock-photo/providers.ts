export interface StockPhotoResult {
  url: string
  width: number
  height: number
  photographer: string
  sourceId: string
}

export interface StockPhotoProvider {
  name: string
  search(
    query: string,
    options: {
      perPage: number
      orientation: 'landscape' | 'portrait' | 'square'
      targetDim: number
    }
  ): Promise<StockPhotoResult[]>
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

export function getActiveProvider(): StockPhotoProvider | null {
  if (!activeProviderId) return null
  return providers.get(activeProviderId) ?? null
}

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
    return data.photos.map((photo) => ({
      url: pickPexelsSize(photo.src, targetDim),
      width: photo.width,
      height: photo.height,
      photographer: photo.photographer,
      sourceId: String(photo.id)
    }))
  }
}

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
    return data.results.map((photo) => ({
      url: pickUnsplashSize(photo.urls, 1080),
      width: photo.width,
      height: photo.height,
      photographer: photo.user.name,
      sourceId: photo.id
    }))
  }
}
