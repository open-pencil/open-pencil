import type { FontFaceData, RemoteFontSource, ResolveFontResult } from 'unifont'

import { IS_BROWSER } from '#core/constants'
import { parseFontStyle } from '#core/text/face'
import {
  createProviderUnifont,
  isRemoteFontSource,
  type WebFontResolveOptions,
  type WebUnifont
} from '#core/text/web-font/providers'

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

const WEB_FONT_METADATA_HOSTS = new Set([
  'api.fontshare.com',
  'api.fontsource.org',
  'fonts.bunny.net',
  'fonts.google.com',
  'fonts.googleapis.com'
])

function isWebFontMetadataURL(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && WEB_FONT_METADATA_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const DEFAULT_WEB_FONT_SUBSETS = [
  'latin',
  'latin-ext',
  'vietnamese',
  'cyrillic',
  'cyrillic-ext',
  'greek',
  'greek-ext'
]

export function normalizedCoverageText(text: string): string {
  return Array.from(new Set(text)).sort().join('')
}

export function webFontSubsetsForText(text: string): string[] {
  const subsets = new Set(DEFAULT_WEB_FONT_SUBSETS)
  if (/\p{Script=Arabic}/u.test(text)) subsets.add('arabic')
  if (/\p{Script=Hangul}/u.test(text)) subsets.add('korean')
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) subsets.add('japanese')
  if (/\p{Script=Han}/u.test(text)) {
    subsets.add('chinese-simplified')
    subsets.add('chinese-traditional')
    subsets.add('japanese')
  }
  return [...subsets]
}

function preferredRemoteSource(face: FontFaceData): RemoteFontSource | undefined {
  const sources = face.src.filter(isRemoteFontSource)
  return (
    sources.find((source) => source.format === 'truetype' || source.format === 'ttf') ??
    sources.find((source) => source.format === 'opentype' || source.format === 'otf') ??
    sources.find((source) => source.format === 'woff2') ??
    sources.find((source) => source.format === 'woff') ??
    sources[0]
  )
}

function resolvedRemoteFaces(result: ResolveFontResult): Array<{
  source: RemoteFontSource
  init?: RequestInit
}> {
  const candidates = result.fonts.flatMap((face) => {
    const source = preferredRemoteSource(face)
    return source ? [{ source, init: face.meta?.init, priority: face.meta?.priority ?? 0 }] : []
  })
  const preferredPriority = Math.min(...candidates.map((candidate) => candidate.priority))
  const seen = new Set<string>()
  const faces: Array<{ source: RemoteFontSource; init?: RequestInit }> = []
  for (const candidate of candidates) {
    if (candidate.priority !== preferredPriority || seen.has(candidate.source.url)) continue
    seen.add(candidate.source.url)
    faces.push({ source: candidate.source, init: candidate.init })
  }
  return faces
}

function isArrayBuffer(value: ArrayBuffer | null): value is ArrayBuffer {
  return value !== null
}

function waitForFontOperation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      try {
        signal.throwIfAborted()
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    signal.addEventListener('abort', abort, { once: true })
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
        return undefined
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error instanceof Error ? error : new Error(String(error)))
        return undefined
      }
    )
  })
}

export interface ResolvedWebFont {
  buffers: ArrayBuffer[]
  provider: WebFontProviderId
}

export class WebFontResolver {
  private enabled = new Set<WebFontProviderId>(
    WEB_FONT_PROVIDER_IDS.filter((provider) => DEFAULT_WEB_FONT_PROVIDER_SETTINGS[provider])
  )
  private unifontPromises = new Map<WebFontProviderId, Promise<WebUnifont>>()
  private familiesCache = new Map<WebFontProviderId, string[]>()
  private familiesPromises = new Map<WebFontProviderId, Promise<string[]>>()
  private failedFonts = new Set<string>()
  private fontPromises = new Map<string, Promise<ArrayBuffer[]>>()
  private remoteFetch: WebFontFetch | null = null
  private fetchProxyQueue: Promise<void> = Promise.resolve()

  setEnabled(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.enabled = new Set(WEB_FONT_PROVIDER_IDS.filter((provider) => settings[provider] === true))
    this.failedFonts.clear()
  }

  setRemoteFetch(fetcher: WebFontFetch | null): void {
    this.remoteFetch = fetcher
    this.unifontPromises.clear()
    this.familiesPromises.clear()
    this.familiesCache.clear()
    this.failedFonts.clear()
  }

  resetFailures(family?: string, style?: string): void {
    for (const key of this.failedFonts) {
      const [, failedFamily, failedStyle] = key.split('|')
      if (!family || (failedFamily === family && (!style || failedStyle === style))) {
        this.failedFonts.delete(key)
      }
    }
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

  async fetchFont(
    families: string[],
    style: string,
    characters = '',
    signal?: AbortSignal
  ): Promise<ResolvedWebFont | null> {
    signal?.throwIfAborted()
    const providers = this.enabledProviders()
    if (providers.length === 0 || (IS_BROWSER && !this.remoteFetch)) return null

    for (const family of families) {
      for (const provider of providers) {
        signal?.throwIfAborted()
        const buffers = await this.fetchFromProvider(family, style, provider, characters, signal)
        if (buffers.length > 0) return { buffers, provider }
      }
    }

    return null
  }

  private async withFetchProxy<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!this.remoteFetch) return operation()

    const previous = this.fetchProxyQueue
    let release: (() => void) | undefined
    this.fetchProxyQueue = new Promise<void>((resolve) => {
      release = () => resolve()
    })
    try {
      await waitForFontOperation(previous, signal)
      signal?.throwIfAborted()
    } catch (error) {
      void previous.finally(() => release?.())
      throw error
    }

    const originalFetch = globalThis.fetch
    const proxyFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
      if (isWebFontMetadataURL(url)) {
        signal?.throwIfAborted()
        return (
          this.remoteFetch?.(url, { ...init, signal: signal ?? init?.signal }) ??
          Promise.reject(new TypeError('No font proxy fetcher'))
        )
      }
      return originalFetch(input, init)
    }
    globalThis.fetch = proxyFetch as typeof fetch

    try {
      return await waitForFontOperation(operation(), signal)
    } finally {
      if (globalThis.fetch === proxyFetch) globalThis.fetch = originalFetch
      release?.()
    }
  }

  private async fetchRemote(url: string, init?: RequestInit): Promise<Response> {
    if (this.remoteFetch) return this.remoteFetch(url, init)
    return fetch(url, init)
  }

  private async unifont(provider: WebFontProviderId, signal?: AbortSignal): Promise<WebUnifont> {
    let promise = this.unifontPromises.get(provider)
    if (!promise) {
      promise = this.withFetchProxy(() => createProviderUnifont(provider))
      this.unifontPromises.set(provider, promise)
    }
    return waitForFontOperation(promise, signal)
  }

  private async loadFamilies(provider: WebFontProviderId): Promise<string[]> {
    if (typeof fetch === 'undefined' || (IS_BROWSER && !this.remoteFetch)) return []

    try {
      const unifont = await this.unifont(provider)
      const listedFamilies = await this.withFetchProxy(() => unifont.listFonts())
      const families = listedFamilies
        ? [...new Set(listedFamilies)].sort((a, b) => a.localeCompare(b))
        : []
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
    provider: WebFontProviderId,
    characters: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer[]> {
    const coverage = normalizedCoverageText(characters)
    const key = `${provider}|${family}|${style}|${coverage}`
    if (this.failedFonts.has(key)) return []

    if (signal) {
      const result = await this.loadFromProvider(family, style, provider, coverage, signal)
      if (result.length === 0 && !signal.aborted) this.failedFonts.add(key)
      return result
    }

    let promise = this.fontPromises.get(key)
    if (!promise) {
      promise = this.loadFromProvider(family, style, provider, coverage, signal)
      this.fontPromises.set(key, promise)
    }

    try {
      const result = await promise
      if (result.length === 0) this.failedFonts.add(key)
      return result
    } finally {
      this.fontPromises.delete(key)
    }
  }

  private async loadFromProvider(
    family: string,
    style: string,
    provider: WebFontProviderId,
    characters: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer[]> {
    try {
      signal?.throwIfAborted()
      const parsed = parseFontStyle(style)
      const unifont = await this.unifont(provider, signal)
      const options = {
        weights: [String(parsed.weight)],
        styles: [parsed.italic ? 'italic' : 'normal'],
        formats: ['ttf', 'otf', 'woff2', 'woff'],
        subsets: webFontSubsetsForText(characters),
        ...(provider === 'google' && characters
          ? { options: { google: { experimental: { glyphs: [characters] } } } }
          : {})
      } satisfies WebFontResolveOptions
      const result = await this.withFetchProxy<ResolveFontResult>(
        () => unifont.resolveFont(family, options),
        signal
      )
      signal?.throwIfAborted()
      const faces = resolvedRemoteFaces(result)
      const buffers = await Promise.all(
        faces.map(async ({ source, init }) => {
          const response = await this.fetchRemote(source.url, { ...init, signal })
          return response.ok ? response.arrayBuffer() : null
        })
      )
      return buffers.filter(isArrayBuffer)
    } catch (error) {
      if (signal?.aborted) throw error
      return []
    }
  }
}
