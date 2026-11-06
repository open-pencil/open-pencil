import { ofetch } from 'ofetch'
import * as v from 'valibot'

export interface StockPhotoResult {
  /** The image at the size asked for, to place in the document. */
  url: string
  /** A small image for a grid of results. */
  thumbnailURL: string
  width: number
  height: number
  photographer: string
  /** The photographer's page, which the services ask credits to link to. */
  photographerURL: string
  /** The photo's own page on the service. */
  pageURL: string
  sourceId: string
}

export type StockPhotoOrientation = 'landscape' | 'portrait' | 'square'

export interface StockPhotoSearchOptions {
  perPage: number
  /** Results page, from 1. */
  page?: number
  /** Any shape when unset. */
  orientation?: StockPhotoOrientation
  targetDim: number
}

export interface StockPhotoProvider {
  name: string
  /** The service's name as people know it: "Pexels". */
  label?: string
  search(query: string, options: StockPhotoSearchOptions): Promise<StockPhotoResult[]>
  /** The photos the service shows before a search: Unsplash's editorial feed, Pexels' curated. */
  browse?(options: StockPhotoSearchOptions): Promise<StockPhotoResult[]>
  /**
   * Tells the service a photo was used, which Unsplash's API terms require of every placed
   * photo; services that do not ask for it leave this out.
   */
  reportUse?(photo: StockPhotoResult): Promise<void>
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

/** The chosen service, or the first one with a key once the chosen one's key is removed. */
export function getActiveProvider(): StockPhotoProvider | null {
  const active = activeProviderId ? providers.get(activeProviderId) : undefined
  return active ?? providers.values().next().value ?? null
}

type CredentialSource = string | null | (() => Promise<string | null>)

async function resolveCredential(source: CredentialSource): Promise<string | null> {
  return typeof source === 'function' ? source() : source
}

const pexelsSearchSchema = v.object({
  photos: v.array(
    v.object({
      id: v.number(),
      width: v.number(),
      height: v.number(),
      url: v.string(),
      photographer: v.string(),
      photographer_url: v.string(),
      src: v.object({
        original: v.string(),
        large2x: v.string(),
        large: v.string(),
        medium: v.string(),
        small: v.string()
      })
    })
  )
})
type PexelsPhoto = v.InferOutput<typeof pexelsSearchSchema>['photos'][number]

function pickPexelsSize(src: PexelsPhoto['src'], targetDim: number): string {
  if (targetDim <= 200) return src.small
  if (targetDim <= 400) return src.medium
  if (targetDim <= 800) return src.large
  if (targetDim <= 1600) return src.large2x
  return src.original
}

let pexelsAPIKey: CredentialSource = null

export function setPexelsAPIKey(key: CredentialSource): void {
  pexelsAPIKey = key
  if (key) {
    registerStockPhotoProvider(pexelsProvider)
    setActiveStockPhotoProvider('pexels')
  } else {
    providers.delete(pexelsProvider.name)
  }
}

async function pexelsPhotos(
  path: string,
  query: Record<string, string | number | undefined>,
  targetDim: number
): Promise<StockPhotoResult[]> {
  const key = await resolveCredential(pexelsAPIKey)
  if (!key) throw new Error('Pexels API key not configured')
  const response = await ofetch.raw(`https://api.pexels.com/v1/${path}`, {
    headers: { Authorization: key },
    ignoreResponseError: true,
    query,
    retry: 0
  })
  if (!response.ok) throw new Error(`Pexels ${response.status}`)
  const data = v.parse(pexelsSearchSchema, response._data)
  return data.photos.map((photo) => ({
    url: pickPexelsSize(photo.src, targetDim),
    thumbnailURL: photo.src.medium,
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer,
    photographerURL: photo.photographer_url,
    pageURL: photo.url,
    sourceId: String(photo.id)
  }))
}

const pexelsProvider: StockPhotoProvider = {
  name: 'pexels',
  label: 'Pexels',
  search(query, { perPage, page = 1, orientation, targetDim }) {
    return pexelsPhotos('search', { query, per_page: perPage, page, orientation }, targetDim)
  },
  browse({ perPage, page = 1, targetDim }) {
    return pexelsPhotos('curated', { per_page: perPage, page }, targetDim)
  }
}

const unsplashPhotoSchema = v.object({
  id: v.string(),
  width: v.number(),
  height: v.number(),
  urls: v.object({
    raw: v.string(),
    full: v.string(),
    regular: v.string(),
    small: v.string(),
    thumb: v.string()
  }),
  user: v.object({ name: v.string(), links: v.object({ html: v.string() }) }),
  links: v.object({ html: v.string(), download_location: v.string() })
})
type UnsplashPhoto = v.InferOutput<typeof unsplashPhotoSchema>
const unsplashSearchSchema = v.object({ results: v.array(unsplashPhotoSchema) })
const unsplashListSchema = v.array(unsplashPhotoSchema)

/** How long a use report may take; the photo is already placed, so a slow one is dropped. */
const REPORT_USE_TIMEOUT_MS = 10_000

/** Unsplash asks for links back to it to name the app they come from. */
const UNSPLASH_REFERRAL = 'utm_source=openpencil&utm_medium=referral'

function unsplashLink(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${UNSPLASH_REFERRAL}`
}

function pickUnsplashSize(urls: UnsplashPhoto['urls'], targetDim: number): string {
  if (targetDim <= 200) return urls.thumb
  if (targetDim <= 400) return urls.small
  if (targetDim <= 1080) return urls.regular
  return urls.full
}

let unsplashAccessKey: CredentialSource = null
/** Where to report each placed photo, by photo; Unsplash gives it with the search result. */
const unsplashDownloads = new Map<string, string>()

export function setUnsplashAccessKey(key: CredentialSource): void {
  unsplashAccessKey = key
  if (key) registerStockPhotoProvider(unsplashProvider)
  else providers.delete(unsplashProvider.name)
}

async function unsplashHeaders(): Promise<Record<string, string>> {
  const key = await resolveCredential(unsplashAccessKey)
  if (!key) throw new Error('Unsplash access key not configured')
  return { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }
}

async function unsplashGet(path: string, query: Record<string, string | number | undefined>) {
  const response = await ofetch.raw(`https://api.unsplash.com/${path}`, {
    headers: await unsplashHeaders(),
    ignoreResponseError: true,
    query,
    retry: 0
  })
  if (!response.ok) throw new Error(`Unsplash ${response.status}`)
  return response._data
}

function unsplashResult(photo: UnsplashPhoto, targetDim: number): StockPhotoResult {
  unsplashDownloads.set(photo.id, photo.links.download_location)
  return {
    url: pickUnsplashSize(photo.urls, targetDim),
    thumbnailURL: photo.urls.small,
    width: photo.width,
    height: photo.height,
    photographer: photo.user.name,
    photographerURL: unsplashLink(photo.user.links.html),
    pageURL: unsplashLink(photo.links.html),
    sourceId: photo.id
  }
}

const unsplashProvider: StockPhotoProvider = {
  name: 'unsplash',
  label: 'Unsplash',
  async search(query, { perPage, page = 1, orientation, targetDim }) {
    const data = v.parse(
      unsplashSearchSchema,
      await unsplashGet('search/photos', {
        query,
        per_page: perPage,
        page,
        orientation: orientation === 'square' ? 'squarish' : orientation
      })
    )
    return data.results.map((photo) => unsplashResult(photo, targetDim))
  },
  async browse({ perPage, page = 1, targetDim }) {
    const data = v.parse(
      unsplashListSchema,
      await unsplashGet('photos', { per_page: perPage, page })
    )
    return data.map((photo) => unsplashResult(photo, targetDim))
  },
  async reportUse(photo) {
    const location = unsplashDownloads.get(photo.sourceId)
    if (!location) return
    await ofetch(location, {
      headers: await unsplashHeaders(),
      retry: 0,
      timeout: REPORT_USE_TIMEOUT_MS
    })
  }
}

/** The registered service called `name`, such as "pexels", or null without its key. */
export function getStockPhotoProvider(name: string): StockPhotoProvider | null {
  return providers.get(name) ?? null
}

/**
 * What one request with a key says about it: it works, the service refused it, the hourly
 * limit is used up, or the service could not be reached or answered something else.
 */
export type StockPhotoKeyCheck = 'ok' | 'rejected' | 'rate-limited' | 'network' | 'failed'

/**
 * Checks a key with the cheapest request each service has, one photo from the list shown before a
 * search; it counts against the hourly limit like any other.
 */
export async function checkStockPhotoKey(
  service: 'pexels' | 'unsplash',
  key: string
): Promise<StockPhotoKeyCheck> {
  const request: { url: string; headers: Record<string, string> } =
    service === 'pexels'
      ? { url: 'https://api.pexels.com/v1/curated', headers: { Authorization: key } }
      : {
          url: 'https://api.unsplash.com/photos',
          headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }
        }
  let response
  try {
    response = await ofetch.raw(request.url, {
      headers: request.headers,
      ignoreResponseError: true,
      query: { per_page: 1 },
      responseType: 'text',
      retry: 0
    })
  } catch {
    return 'network'
  }
  if (response.ok) return 'ok'
  // Unsplash answers a used-up hour with 403 and no requests remaining; Pexels with 429.
  if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0') {
    return 'rate-limited'
  }
  return response.status === 401 || response.status === 403 ? 'rejected' : 'failed'
}
