import {
  createUnifont,
  providers,
  type RemoteFontSource,
  type ResolveFontOptions,
  type ResolveFontResult,
  type Unifont
} from 'unifont'

import { IS_BROWSER } from '#core/constants'
import { parseFontStyle } from '#core/text/face'

export const WEB_FONT_PROVIDER_IDS = ['google', 'fontsource', 'bunny', 'fontshare'] as const
export type WebFontProviderId = (typeof WEB_FONT_PROVIDER_IDS)[number]

export const WEB_FONT_PROVIDER_LABELS: Record<WebFontProviderId, string> = {
  google: 'Google Fonts',
  fontsource: 'Fontsource',
  bunny: 'Bunny Fonts',
  fontshare: 'Fontshare'
}

export const DEFAULT_WEB_FONT_PROVIDER_SETTINGS: Record<WebFontProviderId, boolean> = {
  google: true,
  fontsource: true,
  bunny: false,
  fontshare: false
}

export type WebFontFetch = (url: string, init?: RequestInit) => Promise<Response>

type WebFontProvider =
  | ReturnType<typeof providers.google>
  | ReturnType<typeof providers.fontsource>
  | ReturnType<typeof providers.bunny>
  | ReturnType<typeof providers.fontshare>
type WebUnifont = Unifont<[WebFontProvider]>
type WebFontResolveOptions = Pick<ResolveFontOptions, 'weights' | 'styles' | 'formats' | 'subsets'>

const providerFactories = {
  google: providers.google,
  fontsource: providers.fontsource,
  bunny: providers.bunny,
  fontshare: providers.fontshare
} satisfies Record<WebFontProviderId, () => WebFontProvider>

let fetchProxyQueue = Promise.resolve()

function httpRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string' || input instanceof URL) return input.toString()
  return input.url
}

async function proxiedRequestInit(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<RequestInit> {
  const request = new Request(input, init)
  const body = request.body ? await request.clone().arrayBuffer() : undefined
  return {
    body,
    cache: request.cache,
    credentials: request.credentials,
    headers: request.headers,
    integrity: request.integrity,
    keepalive: request.keepalive,
    method: request.method,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal
  }
}

function deferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  if (!resolvePromise) throw new Error('Failed to initialize web font fetch proxy queue')
  return { promise, resolve: resolvePromise }
}

export async function withWebFontFetchProxy<T>(
  fetcher: WebFontFetch | null,
  operation: () => Promise<T>
): Promise<T> {
  if (!fetcher) return operation()

  const previousOperation = fetchProxyQueue
  const currentOperation = deferredVoid()
  fetchProxyQueue = previousOperation.then(() => currentOperation.promise)
  await previousOperation

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = httpRequestUrl(input)
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return fetcher(url, await proxiedRequestInit(input, init))
    }
    return originalFetch(input, init)
  }) as typeof fetch

  try {
    return await operation()
  } finally {
    globalThis.fetch = originalFetch
    currentOperation.resolve()
  }
}

async function createProviderUnifont(provider: WebFontProviderId): Promise<WebUnifont> {
  return createUnifont([providerFactories[provider]()], { throwOnError: false })
}

function isRemoteFontSource(
  source: RemoteFontSource | { name: string }
): source is RemoteFontSource {
  return 'url' in source
}

export class WebFontResolver {
  private enabled = new Set<WebFontProviderId>(
    WEB_FONT_PROVIDER_IDS.filter((provider) => DEFAULT_WEB_FONT_PROVIDER_SETTINGS[provider])
  )
  private unifontPromises = new Map<WebFontProviderId, Promise<WebUnifont>>()
  private familiesCache = new Map<WebFontProviderId, string[]>()
  private familiesPromises = new Map<WebFontProviderId, Promise<string[]>>()
  private failedFonts = new Set<string>()
  private fontPromises = new Map<string, Promise<ArrayBuffer | null>>()
  private remoteFetch: WebFontFetch | null = null

  setEnabled(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.enabled = new Set(WEB_FONT_PROVIDER_IDS.filter((provider) => settings[provider] === true))
  }

  setRemoteFetch(fetcher: WebFontFetch | null): void {
    this.remoteFetch = fetcher
    this.unifontPromises.clear()
    this.familiesPromises.clear()
    this.familiesCache.clear()
  }

  enabledProviders(): WebFontProviderId[] {
    return WEB_FONT_PROVIDER_IDS.filter((provider) => this.enabled.has(provider))
  }

  preloadFamilies(): void {
    if (IS_BROWSER && !this.remoteFetch) return
    for (const provider of this.enabledProviders()) void this.listFamilies(provider)
  }

  async listFamilies(provider: WebFontProviderId): Promise<string[]> {
    const cached = this.familiesCache.get(provider)
    if (cached) return cached

    let promise = this.familiesPromises.get(provider)
    if (!promise) {
      promise = this.loadFamilies(provider)
      this.familiesPromises.set(provider, promise)
    }
    return promise
  }

  async fetchFont(families: string[], style: string): Promise<ArrayBuffer | null> {
    const providers = this.enabledProviders()
    if (providers.length === 0 || (IS_BROWSER && !this.remoteFetch)) return null

    for (const family of families) {
      for (const provider of providers) {
        const buffer = await this.fetchFromProvider(family, style, provider)
        if (buffer) return buffer
      }
    }

    return null
  }

  private async withFetchProxy<T>(operation: () => Promise<T>): Promise<T> {
    return withWebFontFetchProxy(this.remoteFetch, operation)
  }

  private async fetchRemote(url: string, init?: RequestInit): Promise<Response> {
    if (this.remoteFetch) return this.remoteFetch(url, init)
    return fetch(url, init)
  }

  private async unifont(provider: WebFontProviderId): Promise<WebUnifont> {
    let promise = this.unifontPromises.get(provider)
    if (!promise) {
      promise = this.withFetchProxy(() => createProviderUnifont(provider))
      this.unifontPromises.set(provider, promise)
    }
    return promise
  }

  private async loadFamilies(provider: WebFontProviderId): Promise<string[]> {
    if (typeof fetch === 'undefined' || (IS_BROWSER && !this.remoteFetch)) return []

    try {
      const unifont = await this.unifont(provider)
      const listedFamilies = await this.withFetchProxy(() => unifont.listFonts())
      const families = listedFamilies ? [...new Set(listedFamilies)].sort() : []
      this.familiesCache.set(provider, families)
      return families
    } catch {
      this.familiesCache.set(provider, [])
      return []
    }
  }

  private async fetchFromProvider(
    family: string,
    style: string,
    provider: WebFontProviderId
  ): Promise<ArrayBuffer | null> {
    const key = `${provider}|${family}|${style}`
    if (this.failedFonts.has(key)) return null

    let promise = this.fontPromises.get(key)
    if (!promise) {
      promise = this.loadFromProvider(family, style, provider)
      this.fontPromises.set(key, promise)
    }

    const result = await promise
    this.fontPromises.delete(key)
    if (!result) this.failedFonts.add(key)
    return result
  }

  private async loadFromProvider(
    family: string,
    style: string,
    provider: WebFontProviderId
  ): Promise<ArrayBuffer | null> {
    try {
      const parsed = parseFontStyle(style)
      const unifont = await this.unifont(provider)
      const options = {
        weights: [String(parsed.weight)],
        styles: [parsed.italic ? 'italic' : 'normal'],
        formats: ['ttf'],
        subsets: ['latin']
      } satisfies WebFontResolveOptions
      const result = await this.withFetchProxy<ResolveFontResult>(() =>
        unifont.resolveFont(family, options)
      )

      const sources = result.fonts
        .toSorted((a, b) => (a.meta?.priority ?? 0) - (b.meta?.priority ?? 0))
        .flatMap((font) => font.src.filter(isRemoteFontSource))
      if (sources.length === 0) return null
      const source =
        sources.find((item) => item.format === 'truetype' || item.format === 'ttf') ?? sources[0]

      const response = await this.fetchRemote(source.url)
      if (!response.ok) return null
      return await response.arrayBuffer()
    } catch {
      return null
    }
  }
}
