import { uniq } from 'es-toolkit'
import type { FontFaceData, RemoteFontSource, ResolveFontResult } from 'unifont'

import { parseFontStyle } from '@open-pencil/scene-graph/font-style'

import { IS_BROWSER } from '#core/constants'
import {
  ARABIC_CHARACTER,
  HAN_CHARACTER,
  HANGUL_CHARACTER,
  KANA_CHARACTER
} from '#core/text/fallbacks'
import { standardFace, type FamilyFace } from '#core/text/font/faces'
import { sfntFont } from '#core/text/font/woff2'
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

/**
 * Hosts the font providers' metadata and stylesheet requests go to. Only these are proxied while
 * a provider resolves; the app's other requests in that window keep their own fetch.
 */
const WEB_FONT_PROVIDER_HOSTS = new Set([
  'api.fontshare.com',
  'api.fontsource.org',
  'cdn.jsdelivr.net',
  'fonts.bunny.net',
  'fonts.google.com',
  'fonts.googleapis.com'
])

function isWebFontProviderURL(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return url.protocol === 'https:' && WEB_FONT_PROVIDER_HOSTS.has(url.hostname)
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
  if (ARABIC_CHARACTER.test(text)) subsets.add('arabic')
  if (HANGUL_CHARACTER.test(text)) subsets.add('korean')
  if (KANA_CHARACTER.test(text)) subsets.add('japanese')
  if (HAN_CHARACTER.test(text)) {
    subsets.add('chinese-simplified')
    subsets.add('chinese-traditional')
    subsets.add('japanese')
  }
  return [...subsets]
}

function preferredRemoteSource(face: FontFaceData): RemoteFontSource | undefined {
  const sources = face.src.filter(isRemoteFontSource)
  // WOFF2 is decoded on arrival, and it is the only format Google serves variable fonts in.
  return (
    sources.find((source) => source.format === 'woff2') ??
    sources.find((source) => source.format === 'truetype' || source.format === 'ttf') ??
    sources.find((source) => source.format === 'opentype' || source.format === 'otf') ??
    sources.find((source) => source.format === 'woff') ??
    sources[0]
  )
}

const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

/** The standard weights a face covers: one, or every one in a variable font's range. */
function faceWeights(weight: FontFaceData['weight']): number[] {
  const bounds = Array.isArray(weight)
    ? weight
    : String(weight ?? 400)
        .trim()
        .split(/\s+/u)
        .map(Number)
  const [min = 400, max = min] = bounds
  return STANDARD_WEIGHTS.filter((value) => value >= min && value <= max)
}

function familyFacesOf(result: ResolveFontResult): FamilyFace[] {
  const faces = new Map<string, FamilyFace>()
  for (const font of result.fonts) {
    const italic = font.style === 'italic' || font.style?.startsWith('oblique') === true
    for (const weight of faceWeights(font.weight))
      faces.set(`${weight}${italic ? 'i' : ''}`, standardFace(weight, italic))
  }
  return [...faces.values()]
}

/** Whether a face's `unicode-range` (`U+3000-303F`, `U+4E??`) holds `codePoint`. */
function inUnicodeRange(range: readonly string[], codePoint: number): boolean {
  return range.some((part) => {
    const [start = '', end = start] = part.trim().replace(/^U\+/iu, '').split('-')
    const low = Number.parseInt(start.replaceAll('?', '0'), 16)
    const high = Number.parseInt(end.replaceAll('?', 'F'), 16)
    return codePoint >= low && codePoint <= high
  })
}

/**
 * The faces to download for `characters`: those whose `unicode-range` holds one of them, as a
 * browser picks the files of a split family. A CJK family comes in a hundred or more such shards.
 * Without characters, every face; when no range holds one, such as an emoji asked of a text
 * family, only the first face, the provider's default subset, so the family still loads.
 */
function facesForCharacters(result: ResolveFontResult, characters: string): FontFaceData[] {
  const codePoints = Array.from(characters, (character) => character.codePointAt(0) ?? 0)
  if (codePoints.length === 0) return result.fonts
  const covering = result.fonts.filter(
    (face) =>
      !face.unicodeRange ||
      codePoints.some((codePoint) => inUnicodeRange(face.unicodeRange ?? [], codePoint))
  )
  return covering.length > 0 ? covering : result.fonts.slice(0, 1)
}

function resolvedRemoteFaces(
  result: ResolveFontResult,
  characters: string
): Array<{
  source: RemoteFontSource
  init?: RequestInit
}> {
  const candidates = facesForCharacters(result, characters).flatMap((face) => {
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
  private facesCache = new Map<string, Promise<FamilyFace[]>>()
  private familiesPromises = new Map<WebFontProviderId, Promise<string[]>>()
  private failedFonts = new Set<string>()
  private fontPromises = new Map<string, Promise<ArrayBuffer[]>>()
  private remoteFetch: WebFontFetch | null = null
  private fetchProxyQueue: Promise<void> = Promise.resolve()

  setEnabled(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.enabled = new Set(WEB_FONT_PROVIDER_IDS.filter((provider) => settings[provider] === true))
    this.failedFonts.clear()
    this.facesCache.clear()
  }

  setRemoteFetch(fetcher: WebFontFetch | null): void {
    this.remoteFetch = fetcher
    this.unifontPromises.clear()
    this.familiesPromises.clear()
    this.familiesCache.clear()
    this.facesCache.clear()
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

  /**
   * The faces a family has at the first enabled provider that serves it, or none when no
   * provider does. Asking a provider for every weight in both slants returns only the faces it
   * has, without downloading them.
   */
  familyFaces(family: string): Promise<FamilyFace[]> {
    let faces = this.facesCache.get(family)
    if (!faces) {
      faces = this.loadFamilyFaces(family)
      this.facesCache.set(family, faces)
    }
    return faces
  }

  private async loadFamilyFaces(family: string): Promise<FamilyFace[]> {
    if (typeof fetch === 'undefined' || (IS_BROWSER && !this.remoteFetch)) return []
    for (const provider of this.enabledProviders()) {
      try {
        const unifont = await this.unifont(provider)
        const result = await this.withFetchProxy<ResolveFontResult>(() =>
          unifont.resolveFont(family, {
            weights: STANDARD_WEIGHTS.map(String),
            styles: ['normal', 'italic'],
            formats: ['woff2', 'woff', 'ttf', 'otf']
          })
        )
        const faces = familyFacesOf(result)
        if (faces.length > 0) return faces
      } catch (error) {
        // The next provider may serve the family.
        console.warn(`[fonts] ${provider} could not list the faces of ${family}:`, error)
      }
    }
    return []
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
      if (isWebFontProviderURL(url)) {
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

  /**
   * The weights to ask for a style in, and the other axes: a variable family's whole range, so one
   * file draws every weight and axis it has, or the style's own weight. unifont narrows each range
   * to what the provider serves.
   */
  private async requestedAxes(
    unifont: WebUnifont,
    family: string,
    weight: number,
    signal?: AbortSignal
  ): Promise<Pick<WebFontResolveOptions, 'weights' | 'variableAxis'>> {
    const properties = await this.withFetchProxy(() => unifont.getFontProperties(family), signal)
    const axes = properties?.axes ?? []
    const wght = axes.find((axis) => axis.tag === 'wght')
    const range = wght
      ? [wght.min, wght.max]
      : properties?.weights
          ?.map((value) => value.split(' ').map(Number))
          .find((bounds) => bounds.length === 2)
    const [min = weight, max = weight] = range ?? []
    if (!range || weight < min || weight > max) return { weights: [String(weight)] }
    const others = axes.filter((axis) => axis.tag !== 'wght' && axis.tag !== 'ital')
    return {
      weights: [`${min} ${max}`],
      variableAxis: Object.fromEntries(
        others.map((axis) => [axis.tag, [{ min: axis.min, max: axis.max }]])
      )
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
      const families = listedFamilies ? uniq(listedFamilies).sort((a, b) => a.localeCompare(b)) : []
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
      const { weights, variableAxis } = await this.requestedAxes(
        unifont,
        family,
        parsed.weight,
        signal
      )
      const options: WebFontResolveOptions = {
        weights,
        styles: [parsed.italic ? 'italic' : 'normal'],
        formats: ['woff2', 'ttf', 'otf', 'woff'],
        subsets: webFontSubsetsForText(characters),
        variableAxis
      }
      if (provider === 'google' && characters) {
        options.options = { google: { experimental: { glyphs: [characters] } } }
      }
      const result = await this.withFetchProxy<ResolveFontResult>(
        () => unifont.resolveFont(family, options),
        signal
      )
      signal?.throwIfAborted()
      const faces = resolvedRemoteFaces(result, characters)
      const buffers = await Promise.all(
        faces.map(async ({ source, init }) => {
          const response = await this.fetchRemote(source.url, { ...init, signal })
          return response.ok ? sfntFont(await response.arrayBuffer()) : null
        })
      )
      return buffers.filter(isArrayBuffer)
    } catch (error) {
      if (signal?.aborted) throw error
      return []
    }
  }
}
