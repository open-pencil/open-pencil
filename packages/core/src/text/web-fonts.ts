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

/** Browser without Tauri proxy: prefer CORS-safe TTF hosts before Google metadata. */
export const BROWSER_WEB_FONT_PROVIDER_ORDER = [
  'fontsource',
  'google',
  'bunny',
  'fontshare'
] as const satisfies readonly WebFontProviderId[]

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

/** Pure ordering helper — unit-testable without browser globals. */
export function resolveWebFontProviderOrder(
  enabled: readonly WebFontProviderId[],
  options: { preferCorsSafeTtf: boolean }
): WebFontProviderId[] {
  if (enabled.length === 0) return []
  const enabledSet = new Set(enabled)
  if (options.preferCorsSafeTtf) {
    return BROWSER_WEB_FONT_PROVIDER_ORDER.filter((provider) => enabledSet.has(provider))
  }
  return WEB_FONT_PROVIDER_IDS.filter((provider) => enabledSet.has(provider))
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

  enabledProviders(): WebFontProviderId[] {
    return WEB_FONT_PROVIDER_IDS.filter((provider) => this.enabled.has(provider))
  }

  /**
   * Provider try-order for on-demand `fetchFont`.
   * Browser without remoteFetch: Fontsource first (CORS TTF). Else catalog order (Google first).
   */
  resolveProviderOrder(): WebFontProviderId[] {
    return resolveWebFontProviderOrder(this.enabledProviders(), {
      preferCorsSafeTtf: IS_BROWSER && !this.remoteFetch
    })
  }

  preloadFamilies(): void {
    // Catalog preload stays desktop/proxy-only — Google metadata is not CORS-safe in browsers.
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

  async fetchFont(families: string[], style: string, characters = ''): Promise<ArrayBuffer[]> {
    // On-demand fetch works in browsers without a proxy — resolveProviderOrder puts the
    // CORS-safe hosts first. Only the catalog listing stays proxy-gated.
    if (typeof fetch === 'undefined' && !this.remoteFetch) return []
    const providers = this.resolveProviderOrder()
    if (providers.length === 0) return []

    for (const family of families) {
      for (const provider of providers) {
        const buffers = await this.fetchFromProvider(family, style, provider, characters)
        if (buffers.length > 0) return buffers
      }
    }

    return []
  }

  private async withFetchProxy<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.remoteFetch) return operation()

    const previous = this.fetchProxyQueue
    let release: (() => void) | undefined
    this.fetchProxyQueue = new Promise<void>((resolve) => {
      release = () => resolve()
    })
    await previous

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
      if (url.startsWith('https://') || url.startsWith('http://')) {
        return (
          this.remoteFetch?.(url, init) ?? Promise.reject(new TypeError('No font proxy fetcher'))
        )
      }
      return originalFetch(input, init)
    }) as typeof fetch

    try {
      return await operation()
    } finally {
      globalThis.fetch = originalFetch
      release?.()
    }
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
    // Keep catalog listing gated on web without proxy (Google metadata has no CORS).
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
    characters: string
  ): Promise<ArrayBuffer[]> {
    const coverage = normalizedCoverageText(characters)
    const key = `${provider}|${family}|${style}|${coverage}`
    if (this.failedFonts.has(key)) return []

    let promise = this.fontPromises.get(key)
    if (!promise) {
      promise = this.loadFromProvider(family, style, provider, coverage)
      this.fontPromises.set(key, promise)
    }

    const result = await promise
    this.fontPromises.delete(key)
    if (result.length === 0) this.failedFonts.add(key)
    return result
  }

  private async loadFromProvider(
    family: string,
    style: string,
    provider: WebFontProviderId,
    characters: string
  ): Promise<ArrayBuffer[]> {
    try {
      const parsed = parseFontStyle(style)
      const unifont = await this.unifont(provider)
      const options = {
        weights: [String(parsed.weight)],
        styles: [parsed.italic ? 'italic' : 'normal'],
        formats: ['ttf', 'otf', 'woff2', 'woff'],
        subsets: webFontSubsetsForText(characters),
        ...(provider === 'google' && characters
          ? { options: { google: { experimental: { glyphs: [characters] } } } }
          : {})
      } satisfies WebFontResolveOptions
      const result = await this.withFetchProxy<ResolveFontResult>(() =>
        unifont.resolveFont(family, options)
      )
      const faces = resolvedRemoteFaces(result)
      const buffers = await Promise.all(
        faces.map(async ({ source, init }) => {
          const response = await this.fetchRemote(source.url, init)
          return response.ok ? response.arrayBuffer() : null
        })
      )
      return buffers.filter(isArrayBuffer)
    } catch {
      return []
    }
  }
}
