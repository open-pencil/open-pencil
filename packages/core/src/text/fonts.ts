/* eslint-disable max-lines -- font loading and registration share FontManager lifecycle state */

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { FontVariation, SceneGraph } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY, IS_BROWSER } from '#core/constants'
import { fontFaceRenderFamily } from '#core/text/face'
import { facesFromStyles, hasFamilyFace, type FamilyFace } from '#core/text/font/faces'
import { chooseLocalFontMatch } from '#core/text/font/style'
import {
  fontAxes,
  namedInstances,
  namedInstanceVariations,
  type FontAxis,
  type NamedInstance
} from '#core/text/font/variation'

export * from '#core/text/font/sources'
export * from '#core/text/font/style'
export * from '#core/text/font/variation'
export * from '#core/text/font/woff2'
import {
  normalizeFontFamily,
  parseFontStyle,
  styleToWeight,
  weightToStyle
} from '@open-pencil/scene-graph/font-style'

import { fontFallbackEntry } from '#core/text/fallbacks'
import type { FontFallbackScript } from '#core/text/fallbacks'
import { loadHarfBuzz } from '#core/text/font/harfbuzz'
import { UnsupportedFontFormatError } from '#core/text/font/sources'
import type {
  DownloadedFontCache,
  FontFamilyOption,
  FontInfo,
  FontLoadedSource,
  FontUnavailableReason,
  HostFontLoader,
  LocalFontAccessState
} from '#core/text/font/sources'
import { collectGraphFontKeys } from '#core/text/requirements'
import { normalizedCoverageText, WebFontResolver } from '#core/text/web-fonts'
import type { WebFontFetch, WebFontProviderId } from '#core/text/web-fonts'

/** Inter's weights, each drawn from Inter's variable files at its named instance. */
const INTER_WEIGHTS = [
  'Thin',
  'ExtraLight',
  'Light',
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'ExtraBold',
  'Black'
]

const BUNDLED_FONTS: Record<string, string> = {
  ...Object.fromEntries(INTER_WEIGHTS.map((weight) => [`Inter|${weight}`, '/InterVariable.ttf'])),
  ...Object.fromEntries(
    INTER_WEIGHTS.map((weight) => [`Inter|${weight} Italic`, '/InterVariable-Italic.ttf'])
  ),
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf',
  'OpenPencil Emoji Metrics|Regular': '/OpenPencilEmojiMetrics-Regular.ttf'
}

/**
 * Maps a bundled font's file name (`InterVariable.ttf`) to the URL a browser fetches it from.
 * Mirrors CanvasKit's `locateFile`; the default expects the host to serve
 * `@open-pencil/core/assets` at the site root.
 */
export type BundledFontLocator = (file: string) => string

const defaultBundledFontLocator: BundledFontLocator = (file) => `/${file}`

/**
 * Shares the in-flight and successful reads of a key, and forgets a null answer so it can be
 * retried. A host or browser read copies the whole face again each time, tens of megabytes for a
 * system CJK face, only for registration to find the same bytes and drop it.
 */
class SharedReads {
  private readonly reads = new Map<string, Promise<ArrayBuffer | null>>()

  read(key: string, load: () => Promise<ArrayBuffer | null>): Promise<ArrayBuffer | null> {
    const existing = this.reads.get(key)
    if (existing) return existing
    const pending = load()
    this.reads.set(key, pending)
    void pending.then((data) => {
      if (!data && this.reads.get(key) === pending) this.reads.delete(key)
      return undefined
    })
    return pending
  }

  clear(): void {
    this.reads.clear()
  }
}

/** Whether two font files hold the same bytes, as one downloaded or read again does. */
function sameFontFile(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a === b) return true
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false
  return true
}

/** `load`'s answer once HarfBuzz has loaded too, the two loading side by side. */
async function withHarfBuzz<T>(load: Promise<T>): Promise<T> {
  const [answer] = await Promise.all([load, loadHarfBuzz()])
  return answer
}

export class FontManager {
  private loadedFamilies = new Map<string, ArrayBuffer>()
  private loadedFamilySources = new Map<string, FontLoadedSource>()
  private unavailableFaces = new Map<string, FontUnavailableReason>()
  private supplementalFamilyData = new Map<string, ArrayBuffer[]>()
  /** The name each file of a family loaded from several files is registered under. */
  private fileFamilies = new Map<ArrayBuffer, string>()
  /**
   * Families a style's file was replaced in, such as a web font fetched again for more characters.
   * The old file stays registered first under the family's name, and CanvasKit draws with the
   * first file it has for a style, so these draw from each file's own name.
   */
  private replacedFamilies = new Set<string>()
  private remoteCoverage = new Map<string, Set<string>>()
  private instanceVariations = new WeakMap<ArrayBuffer, Map<string, FontVariation[] | null>>()
  private variations = new WeakMap<
    ArrayBuffer,
    { axes: FontAxis[]; instances: NamedInstance[] } | null
  >()
  private blockedNodeIds = new Set<string>()
  private fontProvider: TypefaceFontProvider | null = null
  private bundledFontLocator: BundledFontLocator = defaultBundledFontLocator
  private readonly bundledFontRequests = new Map<string, Promise<ArrayBuffer | null>>()
  private fontProviders = new Set<TypefaceFontProvider>()
  private providerCanvasKits = new WeakMap<TypefaceFontProvider, CanvasKit>()
  private registrationGeneration = 0
  private providerRegistrations = new WeakMap<TypefaceFontProvider, Map<string, Set<ArrayBuffer>>>()
  private localFonts: FontInfo[] | null = null
  private readonly localFontRequests = new SharedReads()
  private hostStyles = new Map<string, readonly string[]>()
  private familyFaceLoads = new Map<string, Promise<FamilyFace[] | null>>()
  private knownFamilyFaces = new Map<string, FamilyFace[] | null>()
  private familyFacesListeners = new Set<() => void>()
  private localFontAccessState: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private downloadedFontCache: DownloadedFontCache | null = null
  private fallbackUserAgent: string | undefined
  private hostFontLoader: HostFontLoader | null = null
  private readonly hostFontRequests = new SharedReads()
  private webFonts = new WebFontResolver()
  private cjkFallbackFamilies: string[] = []
  private cjkFallbackPromise: Promise<string[]> | null = null
  private arabicFallbackFamilies: string[] = []
  private arabicFallbackPromise: Promise<string[]> | null = null

  attachProvider(canvasKit: CanvasKit, provider: TypefaceFontProvider): void {
    this.fontProviders.add(provider)
    this.providerCanvasKits.set(provider, canvasKit)
    this.fontProvider = provider
    this.providerRegistrations.set(provider, new Map())
    this.registrationGeneration++
    for (const [cacheKey, data] of this.loadedFamilies) {
      const separator = cacheKey.indexOf('|')
      const family = cacheKey.slice(0, separator)
      this.registerFontInProvider(provider, family, data)
      for (const supplemental of this.supplementalFamilyData.get(cacheKey) ?? []) {
        this.registerFontInProvider(provider, family, supplemental)
      }
    }
  }

  detachProvider(provider: TypefaceFontProvider): void {
    this.fontProviders.delete(provider)
    this.providerRegistrations.delete(provider)
    if (this.fontProvider === provider) {
      this.fontProvider = Array.from(this.fontProviders).at(-1) ?? null
    }
  }

  provider(): TypefaceFontProvider | null {
    return this.fontProvider
  }

  /** The latest attached provider made by `canvasKit`; another build's provider cannot shape with it. */
  providerFor(canvasKit: CanvasKit): TypefaceFontProvider | null {
    return (
      Array.from(this.fontProviders)
        .reverse()
        .find((provider) => this.providerCanvasKits.get(provider) === canvasKit) ?? null
    )
  }

  generation(): number {
    return this.registrationGeneration
  }

  blockNodesUntilFontsResolve(nodeIds: readonly string[]): void {
    for (const nodeId of nodeIds) this.blockedNodeIds.add(nodeId)
  }

  unblockNodes(nodeIds: readonly string[]): void {
    for (const nodeId of nodeIds) this.blockedNodeIds.delete(nodeId)
  }

  isNodeBlocked(nodeId: string): boolean {
    return this.blockedNodeIds.has(nodeId)
  }

  localAccessState(): LocalFontAccessState {
    return this.localFontAccessState
  }

  setDownloadedFontCache(cache: DownloadedFontCache | null): void {
    this.downloadedFontCache = cache
  }

  setFallbackUserAgent(userAgent: string | undefined): void {
    this.fallbackUserAgent = userAgent
  }

  setHostFontLoader(loader: HostFontLoader | null): void {
    this.hostFontLoader = loader
    this.hostFontRequests.clear()
  }

  /** Lets a host that bundles `@open-pencil/core/assets` itself say where each file ended up. */
  setBundledFontLocator(locate: BundledFontLocator | null): void {
    this.bundledFontLocator = locate ?? defaultBundledFontLocator
  }

  setOnlineFontProviders(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.webFonts.setEnabled(settings)
    this.forgetFamilyFaces()
  }

  /** The system fonts a desktop host lists, by family, with the style names of their faces. */
  setHostFontCatalog(fonts: readonly { family: string; styles: readonly string[] }[]): void {
    this.hostStyles = new Map(fonts.map((font) => [font.family, [...font.styles]]))
    this.forgetFamilyFaces()
  }

  /**
   * The faces a family has: its installed fonts', else a web provider's, else the bundled ones;
   * `null` when nothing says, so a caller offers every weight.
   */
  familyFaces(family: string): Promise<FamilyFace[] | null> {
    let load = this.familyFaceLoads.get(family)
    if (!load) {
      const pending = this.loadFamilyFaces(family).then((faces) => {
        // Faces forgotten while the lookup ran came from the sources it read before.
        if (this.familyFaceLoads.get(family) === pending) this.knownFamilyFaces.set(family, faces)
        return faces
      })
      load = pending
      this.familyFaceLoads.set(family, load)
    }
    return load
  }

  /** The faces `familyFaces` found for a family, once it has; `undefined` before. */
  loadedFamilyFaces(family: string): FamilyFace[] | null | undefined {
    return this.knownFamilyFaces.get(family)
  }

  /** Whether a family has this face, or nothing found so far says it has not. */
  offersFace(family: string, weight: number, italic: boolean): boolean {
    const faces = this.knownFamilyFaces.get(family)
    return !faces || hasFamilyFace(faces, weight, italic)
  }

  /**
   * Calls the listener whenever the faces found so far are forgotten, as when the host's font
   * catalog arrives or online providers change, so a caller asks for its families again.
   */
  onFamilyFacesReset(listener: () => void): () => void {
    this.familyFacesListeners.add(listener)
    return () => this.familyFacesListeners.delete(listener)
  }

  private async loadFamilyFaces(family: string): Promise<FamilyFace[] | null> {
    const installed =
      this.hostStyles.get(family) ??
      this.localFonts?.filter((font) => font.family === family).map((font) => font.style) ??
      []
    if (installed.length > 0) return facesFromStyles(installed)
    const web = await this.webFonts.familyFaces(family)
    if (web.length > 0) return web
    const bundled = Object.keys(BUNDLED_FONTS)
      .filter((key) => key.startsWith(`${family}|`))
      .map((key) => key.slice(family.length + 1))
    return bundled.length > 0 ? facesFromStyles(bundled) : null
  }

  private forgetFamilyFaces(): void {
    this.familyFaceLoads.clear()
    this.knownFamilyFaces.clear()
    for (const listener of this.familyFacesListeners) listener()
  }

  setWebFontFetch(fetcher: WebFontFetch | null): void {
    this.webFonts.setRemoteFetch(fetcher)
  }

  resetWebFontFailures(family?: string, style?: string): void {
    this.webFonts.resetFailures(family, style)
  }

  enabledOnlineFontProviders(): WebFontProviderId[] {
    return this.webFonts.enabledProviders()
  }

  loadCachedFont(family: string, style = 'Regular', characters = ''): Promise<ArrayBuffer | null> {
    return withHarfBuzz(this.restoreCachedFont(family, style, characters))
  }

  private async restoreCachedFont(
    family: string,
    style = 'Regular',
    characters = ''
  ): Promise<ArrayBuffer | null> {
    const cached = await this.readDownloadedFont(family, style, characters)
    if (!cached) return null
    const key = `${family}|${style}`
    const loadedCoverage = this.remoteCoverage.get(key) ?? new Set<string>()
    for (const character of normalizedCoverageText(characters)) loadedCoverage.add(character)
    this.remoteCoverage.set(key, loadedCoverage)
    return this.registerAndCache(family, style, cached, 'cache')
  }

  async requestLocalFontAccess(): Promise<FontInfo[]> {
    if (!IS_BROWSER || !window.queryLocalFonts) {
      this.localFontAccessState = 'unsupported'
      this.localFonts = []
      return []
    }
    try {
      const fonts = await window.queryLocalFonts()
      const seen = new Set<string>()
      const result: FontInfo[] = []
      for (const f of fonts) {
        const key = `${f.family}|${f.style}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          family: f.family,
          fullName: f.fullName,
          style: f.style,
          postscriptName: f.postscriptName
        })
      }
      this.localFonts = result
      this.localFontAccessState = 'granted'
      this.forgetFamilyFaces()
      return result
    } catch {
      this.localFonts = []
      this.localFontAccessState = 'denied'
      return []
    }
  }

  async listFamilies(): Promise<string[]> {
    const options = await this.listFamilyOptions()
    return options.map((option) => option.family)
  }

  async listFamilyOptions(): Promise<FontFamilyOption[]> {
    const fonts = this.localFonts ?? (await this.requestLocalFontAccess())
    const webFontFamilies = await Promise.all(
      this.enabledOnlineFontProviders().map(async (provider) => ({
        provider,
        families: await this.webFonts.listFamilies(provider)
      }))
    )
    const byFamily = new Map<string, FontFamilyOption>()
    byFamily.set(DEFAULT_FONT_FAMILY, { family: DEFAULT_FONT_FAMILY, source: 'bundled' })
    for (const { provider, families } of webFontFamilies) {
      for (const family of families) {
        if (!byFamily.has(family)) byFamily.set(family, { family, source: provider })
      }
    }
    for (const font of fonts) byFamily.set(font.family, { family: font.family, source: 'local' })
    return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family))
  }

  preloadWebFontFamilies(): void {
    this.webFonts.preloadFamilies()
  }

  /**
   * Reads a bundled font. Concurrent loads of one face share a request, so they get the same
   * buffer; it is forgotten once settled, so a failed request can be retried.
   */
  fetchBundledFont(url: string): Promise<ArrayBuffer | null> {
    const pending = this.bundledFontRequests.get(url)
    if (pending) return pending
    const request = this.readBundledFont(url).finally(() => this.bundledFontRequests.delete(url))
    this.bundledFontRequests.set(url, request)
    return request
  }

  private async readBundledFont(url: string): Promise<ArrayBuffer | null> {
    if (IS_BROWSER) {
      const response = await fetch(this.bundledFontLocator(url.replace(/^\//, '')))
      // A missing file answers with an error page, which must not be read as a font.
      return response.ok ? response.arrayBuffer() : null
    }
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
    const packageJSONURL = import.meta.resolve('@open-pencil/core/package.json')
    const buf = await readFile(new URL(`assets${url}`, packageJSONURL))
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  loadLocalFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
    return withHarfBuzz(this.findLocalOrBundledFont(family, style))
  }

  private async findLocalOrBundledFont(
    family: string,
    style = 'Regular'
  ): Promise<ArrayBuffer | null> {
    const loaded = this.loadedFamilies.get(`${family}|${style}`)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      return loaded
    }
    return (
      (await this.loadInstalledFont(family, style)) ?? (await this.loadBundledFont(family, style))
    )
  }

  /** The face installed on this machine, from the host or the browser's local fonts. */
  private async loadInstalledFont(family: string, style: string): Promise<ArrayBuffer | null> {
    const hostBuffer = await this.loadHostFont(family, style)
    if (hostBuffer) return this.registerAndCache(family, style, hostBuffer, 'local')
    const localBuffer = await this.findLocalFont(family, style)
    return localBuffer ? this.registerAndCache(family, style, localBuffer, 'local') : null
  }

  private async loadBundledFont(family: string, style: string): Promise<ArrayBuffer | null> {
    const bundledURL = BUNDLED_FONTS[`${family}|${style}`]
    if (!bundledURL) return null
    try {
      const buffer = await this.fetchBundledFont(bundledURL)
      return buffer ? this.registerAndCache(family, style, buffer, 'bundled') : null
    } catch (e) {
      console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  loadRemoteFont(
    family: string,
    style = 'Regular',
    characters = '',
    signal?: AbortSignal
  ): Promise<ArrayBuffer | null> {
    return withHarfBuzz(this.downloadFont(family, style, characters, signal))
  }

  private async downloadFont(
    family: string,
    style = 'Regular',
    characters = '',
    signal?: AbortSignal
  ): Promise<ArrayBuffer | null> {
    signal?.throwIfAborted()
    if (typeof fetch === 'undefined') return null
    const coverage = this.remoteCoverage.get(`${family}|${style}`)
    if (
      characters &&
      coverage &&
      Array.from(characters).every((character) => coverage.has(character))
    ) {
      return this.loadedData(family, style)
    }
    try {
      const requestedCharacters = normalizedCoverageText(
        `${coverage ? Array.from(coverage).join('') : ''}${characters}`
      )
      const normalized = normalizeFontFamily(family)
      const families = normalized === family ? [family] : [family, normalized]
      const resolved = await this.webFonts.fetchFont(families, style, requestedCharacters, signal)
      if (!resolved || resolved.buffers.length === 0) return null
      const primary = resolved.buffers[0]
      await this.writeDownloadedFont(family, style, primary, requestedCharacters)
      const registered = this.registerAndCache(family, style, primary, resolved.provider)
      const loadedCoverage = this.remoteCoverage.get(`${family}|${style}`) ?? new Set<string>()
      for (const character of requestedCharacters) loadedCoverage.add(character)
      this.remoteCoverage.set(`${family}|${style}`, loadedCoverage)
      for (const supplemental of resolved.buffers.slice(1)) {
        this.registerSupplemental(family, style, supplemental)
      }
      return registered
    } catch (e) {
      if (signal?.aborted) throw e
      console.warn(`Web font fetch failed for "${family}" ${style}:`, e)
      return null
    }
  }

  loadFont(
    family: string,
    style = 'Regular',
    characters = '',
    signal?: AbortSignal
  ): Promise<ArrayBuffer | null> {
    return withHarfBuzz(this.findFont(family, style, characters, signal))
  }

  private async findFont(
    family: string,
    style = 'Regular',
    characters = '',
    signal?: AbortSignal
  ): Promise<ArrayBuffer | null> {
    signal?.throwIfAborted()
    const loaded = this.loadedData(family, style)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      return this.withRemoteCoverage(family, style, loaded, characters, signal)
    }
    // An installed face of the style comes first; otherwise a variable file the family already
    // loaded draws it.
    const installed = await this.loadInstalledFont(family, style)
    if (installed) return installed
    const shared = this.sharedVariableFace(family, style)
    if (shared) return this.withRemoteCoverage(family, style, shared, characters, signal)

    return (
      (await this.loadBundledFont(family, style)) ??
      (await this.loadCachedFont(family, style, characters)) ??
      (await this.loadRemoteFont(family, style, characters, signal))
    )
  }

  /**
   * `data`, or a web font fetched again with `characters` when it came from the web without them,
   * as a provider cuts a font down to the text it is asked for.
   */
  private async withRemoteCoverage(
    family: string,
    style: string,
    data: ArrayBuffer,
    characters: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer> {
    const remoteCoverage = this.remoteCoverage.get(`${family}|${style}`)
    const missingRemoteCoverage = Boolean(
      characters &&
      remoteCoverage &&
      Array.from(characters).some((character) => !remoteCoverage.has(character))
    )
    return missingRemoteCoverage
      ? ((await this.loadRemoteFont(family, style, characters, signal)) ?? data)
      : data
  }

  /**
   * A variable font the family loaded for another style in the same slant whose weight axis
   * reaches this style's weight, registered for this style too: one file draws every weight.
   */
  private sharedVariableFace(family: string, style: string): ArrayBuffer | null {
    const { weight, italic } = parseFontStyle(style)
    for (const [key, data] of this.loadedFamilies) {
      if (!key.startsWith(`${family}|`)) continue
      if (parseFontStyle(key.slice(family.length + 1)).italic !== italic) continue
      const wght = fontAxes(data)?.find((axis) => axis.tag === 'wght')
      if (!wght || weight < wght.min || weight > wght.max) continue
      const coverage = this.remoteCoverage.get(key)
      if (coverage) this.remoteCoverage.set(`${family}|${style}`, new Set(coverage))
      return this.registerAndCache(family, style, data, this.loadedFamilySources.get(key))
    }
    return null
  }

  async ensureNodeFont(family: string, weight: number): Promise<void> {
    await this.loadFont(family, weightToStyle(weight))
  }

  /** Registers a font the caller already has, resolving once its outlines can be read. */
  async markLoaded(
    family: string,
    style: string,
    data: ArrayBuffer,
    source: FontLoadedSource = 'registered'
  ): Promise<void> {
    this.registerAndCache(family, style, data, source)
    await loadHarfBuzz()
  }

  loadedFontSource(family: string, style: string): FontLoadedSource | null {
    return this.loadedFamilySources.get(`${family}|${style}`) ?? null
  }

  /** Why the host could not load an installed face, when it reported a reason. */
  unavailableReason(family: string, style: string): FontUnavailableReason | null {
    return this.unavailableFaces.get(`${family}|${style}`) ?? null
  }

  isLoaded(family: string): boolean {
    return [...this.loadedFamilies.keys()].some((k) => k.startsWith(`${family}|`))
  }

  isStyleLoaded(family: string, style: string): boolean {
    return this.loadedFamilies.has(`${family}|${style}`)
  }

  remoteStyleNeedsCoverage(family: string, style: string, characters: readonly string[]): boolean {
    const coverage = this.remoteCoverage.get(`${family}|${style}`)
    return !!coverage && characters.some((character) => !coverage.has(character))
  }

  loadedData(family: string, style: string): ArrayBuffer | null {
    return this.loadedFamilies.get(`${family}|${style}`) ?? null
  }

  /**
   * The variation axes and named instances of a family's variable font, from a face it has loaded,
   * in the slant asked for where it has one: `null` when the faces it has loaded are static,
   * `undefined` when it has loaded none.
   */
  familyVariation(
    family: string,
    italic?: boolean
  ): { data: ArrayBuffer; axes: FontAxis[]; instances: NamedInstance[] } | null | undefined {
    let loaded = false
    let other: { data: ArrayBuffer; axes: FontAxis[]; instances: NamedInstance[] } | null = null
    for (const [key, data] of this.loadedFamilies) {
      if (!key.startsWith(`${family}|`)) continue
      loaded = true
      let variation = this.variations.get(data)
      if (variation === undefined) {
        const axes = fontAxes(data)
        variation = axes ? { axes, instances: namedInstances(data) } : null
        this.variations.set(data, variation)
      }
      if (!variation) continue
      const slant = parseFontStyle(key.slice(family.length + 1)).italic
      if (italic === undefined || slant === italic) return { data, ...variation }
      other ??= { data, ...variation }
    }
    return loaded ? other : undefined
  }

  /** Axis coordinates for `style` when the loaded face is a variable font, otherwise `null`. */
  namedInstanceVariations(family: string, style: string): FontVariation[] | null {
    const data = this.loadedData(family, style)
    if (!data) return null
    let byStyle = this.instanceVariations.get(data)
    if (!byStyle) {
      byStyle = new Map()
      this.instanceVariations.set(data, byStyle)
    }
    if (!byStyle.has(style)) byStyle.set(style, namedInstanceVariations(data, style))
    return byStyle.get(style) ?? null
  }

  /**
   * The family CanvasKit is asked for to draw `style` of `family`. A family loaded from one file
   * draws under its own name, with every coverage shard, as some CJK and Arabic faces need to
   * paint. Loaded from several files, such as a bundled static face beside a downloaded variable
   * one, CanvasKit would pick among them by the weight each file declares, which can tie; each
   * style then draws from the file loaded for it, registered with its shards under a name of the
   * file's own. So does a family a style's file was replaced in, whose old file CanvasKit would
   * keep drawing under the family's name.
   */
  renderFamily(family: string, style: string): string {
    const data = this.loadedData(family, style)
    if (!data || (this.familyFileCount(family) < 2 && !this.replacedFamilies.has(family)))
      return family
    const name = this.fileFamily(family, data)
    for (const shard of this.supplementalFamilyData.get(`${family}|${style}`) ?? [])
      this.registerFontInCanvasKit(name, shard)
    return name
  }

  /**
   * The names CanvasKit draws the other files of `style` of `family` under, such as the coverage
   * shards of a web font split by unicode-range. CanvasKit draws a character only from the first
   * file registered under a name, so each shard is a family of its own that text falls back to.
   */
  renderShardFamilies(family: string, style: string): string[] {
    return (this.supplementalFamilyData.get(`${family}|${style}`) ?? []).map((data) =>
      this.fileFamily(family, data)
    )
  }

  /** The files of `style` of `family` after its own, such as the shards of a split web font. */
  shardData(family: string, style: string): readonly ArrayBuffer[] {
    return this.supplementalFamilyData.get(`${family}|${style}`) ?? []
  }

  /** The name one file of `family` is registered under on its own. */
  private fileFamily(family: string, data: ArrayBuffer): string {
    let name = this.fileFamilies.get(data)
    if (!name) {
      name = fontFaceRenderFamily(family, `file ${this.fileFamilies.size + 1}`)
      this.fileFamilies.set(data, name)
    }
    this.registerFontInCanvasKit(name, data)
    return name
  }

  /** How many files the family's loaded styles come from. */
  private familyFileCount(family: string): number {
    const files = new Set<ArrayBuffer>()
    for (const [key, data] of this.loadedFamilies) if (key.startsWith(`${family}|`)) files.add(data)
    return files.size
  }

  collectFontKeys(graph: SceneGraph, nodeIds: string[]): Array<[string, string]> {
    return collectGraphFontKeys(graph, nodeIds)
  }

  async ensureCJKFallback(): Promise<string[]> {
    if (this.cjkFallbackFamilies.length > 0) return this.cjkFallbackFamilies
    if (this.cjkFallbackPromise) return this.cjkFallbackPromise

    this.cjkFallbackPromise = this.ensureFallbackFamilies('cjk', this.cjkFallbackFamilies)
    return this.cjkFallbackPromise
  }

  getCJKFallbackFamilies(): string[] {
    return this.cjkFallbackFamilies
  }

  setCJKFallbackFamily(family: string): void {
    if (!this.cjkFallbackFamilies.includes(family)) {
      this.cjkFallbackFamilies.push(family)
    }
  }

  async ensureArabicFallback(): Promise<string[]> {
    if (this.arabicFallbackFamilies.length > 0) return this.arabicFallbackFamilies
    if (this.arabicFallbackPromise) return this.arabicFallbackPromise

    this.arabicFallbackPromise = this.ensureFallbackFamilies('arabic', this.arabicFallbackFamilies)
    return this.arabicFallbackPromise
  }

  ensureFallbackPack(
    scripts: FontFallbackScript[] = ['cjk', 'arabic'],
    characters = '',
    signal?: AbortSignal
  ): Promise<Partial<Record<FontFallbackScript, string[]>>> {
    return withHarfBuzz(this.loadFallbackPack(scripts, characters, signal))
  }

  private async loadFallbackPack(
    scripts: FontFallbackScript[] = ['cjk', 'arabic'],
    characters = '',
    signal?: AbortSignal
  ): Promise<Partial<Record<FontFallbackScript, string[]>>> {
    signal?.throwIfAborted()
    const result: Partial<Record<FontFallbackScript, string[]>> = {}
    await Promise.all(
      scripts.map(async (script) => {
        signal?.throwIfAborted()
        const target = script === 'arabic' ? this.arabicFallbackFamilies : this.cjkFallbackFamilies
        if (signal) {
          result[script] = await this.ensureFallbackFamilies(script, target, characters, signal)
        } else if (script === 'arabic' && !characters) {
          result[script] = await this.ensureArabicFallback()
        } else if (script === 'cjk' && !characters) {
          result[script] = await this.ensureCJKFallback()
        } else {
          result[script] = await this.ensureFallbackFamilies(script, target, characters)
        }
      })
    )
    signal?.throwIfAborted()
    return result
  }

  getArabicFallbackFamilies(): string[] {
    return this.arabicFallbackFamilies
  }

  setArabicFallbackFamily(family: string): void {
    if (!this.arabicFallbackFamilies.includes(family)) {
      this.arabicFallbackFamilies.push(family)
    }
  }

  private async ensureFallbackFamilies(
    script: FontFallbackScript,
    targetFamilies: string[],
    characters = '',
    signal?: AbortSignal
  ): Promise<string[]> {
    signal?.throwIfAborted()
    const manifest = fontFallbackEntry(script, this.fallbackUserAgent)

    for (const family of manifest.localFamilies) {
      signal?.throwIfAborted()
      const buffer =
        (await this.loadHostFont(family, 'Regular')) ?? (await this.findLocalFont(family))
      signal?.throwIfAborted()
      if (
        buffer &&
        this.registerAndCache(family, 'Regular', buffer, 'fallback') &&
        !targetFamilies.includes(family)
      ) {
        targetFamilies.push(family)
      }
    }

    if (targetFamilies.length === 0 || characters) {
      const results = await Promise.allSettled(
        manifest.remoteFamilies.map(async (family) => {
          signal?.throwIfAborted()
          const data = await this.loadRemoteFont(family, 'Regular', characters, signal)
          signal?.throwIfAborted()
          return data ? family : null
        })
      )
      for (const result of results) {
        if (
          result.status === 'fulfilled' &&
          result.value &&
          !targetFamilies.includes(result.value)
        ) {
          targetFamilies.push(result.value)
        }
      }
    }

    return targetFamilies
  }

  private loadHostFont(family: string, style: string): Promise<ArrayBuffer | null> {
    const loader = this.hostFontLoader
    if (!loader) return Promise.resolve(null)
    return this.hostFontRequests.read(`${family}|${style}`, () =>
      this.readHostFont(loader, family, style)
    )
  }

  private async readHostFont(
    loader: HostFontLoader,
    family: string,
    style: string
  ): Promise<ArrayBuffer | null> {
    const key = `${family}|${style}`
    try {
      const data = await loader(family, style)
      // A read that started under a loader the host has replaced must not register its bytes.
      if (this.hostFontLoader !== loader) return null
      if (data) this.unavailableFaces.delete(key)
      return data
    } catch (e) {
      // A failure from a replaced loader says nothing about the face the new loader serves.
      if (this.hostFontLoader !== loader) return null
      if (e instanceof UnsupportedFontFormatError) {
        this.unavailableFaces.set(key, e.reason)
        return null
      }
      console.warn(`Host fallback font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async readDownloadedFont(
    family: string,
    style: string,
    characters = ''
  ): Promise<ArrayBuffer | null> {
    if (!this.downloadedFontCache) return null
    try {
      return await this.downloadedFontCache.read(family, style, characters)
    } catch (e) {
      console.warn(`Downloaded font cache read failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async writeDownloadedFont(
    family: string,
    style: string,
    data: ArrayBuffer,
    characters = ''
  ): Promise<void> {
    if (!this.downloadedFontCache) return
    try {
      await this.downloadedFontCache.write(family, style, data, characters)
    } catch (e) {
      console.warn(`Downloaded font cache write failed for "${family}" ${style}:`, e)
    }
  }

  private findLocalFont(family: string, style?: string): Promise<ArrayBuffer | null> {
    if (!IS_BROWSER || !window.queryLocalFonts) return Promise.resolve(null)
    if (this.localFontAccessState !== 'granted') return Promise.resolve(null)
    // A query answers with a new blob, and so new bytes, every time; the face decides the match.
    return this.localFontRequests.read(`${family}|${style ?? ''}`, () =>
      this.readLocalFont(family, style)
    )
  }

  private async readLocalFont(family: string, style?: string): Promise<ArrayBuffer | null> {
    try {
      const fonts = await window.queryLocalFonts?.()
      if (!fonts) return null
      const match = chooseLocalFontMatch(fonts, family, style)
      if (!match) return null
      const blob: Blob = await match.blob()
      return await blob.arrayBuffer()
    } catch (e) {
      console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
      return null
    }
  }

  private registerSupplemental(family: string, style: string, buffer: ArrayBuffer): void {
    const key = `${family}|${style}`
    const supplemental = this.supplementalFamilyData.get(key) ?? []
    if (supplemental.some((file) => sameFontFile(file, buffer))) return
    supplemental.push(buffer)
    this.supplementalFamilyData.set(key, supplemental)
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
  }

  private registerAndCache(
    family: string,
    style: string,
    buffer: ArrayBuffer,
    source?: FontLoadedSource
  ): ArrayBuffer | null {
    const key = `${family}|${style}`
    const existing = this.loadedFamilies.get(key)
    if (existing && sameFontFile(existing, buffer)) {
      if (source) this.loadedFamilySources.set(key, source)
      this.registerFontInCanvasKit(family, existing)
      return existing
    }
    if (existing) {
      this.registerSupplemental(family, style, existing)
      this.replacedFamilies.add(family)
    }
    this.loadedFamilies.set(key, buffer)
    if (source) this.loadedFamilySources.set(key, source)
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
    return buffer
  }

  private registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
    let registered = false
    for (const provider of this.fontProviders) {
      registered = this.registerFontInProvider(provider, family, data) || registered
    }
    return registered
  }

  private registerFontInProvider(
    provider: TypefaceFontProvider,
    family: string,
    data: ArrayBuffer
  ): boolean {
    if (data.byteLength < 4) return false
    const registrations = this.providerRegistrations.get(provider) ?? new Map()
    const registeredData = registrations.get(family)
    if (registeredData?.has(data)) return true
    try {
      provider.registerFont(data, family)
      const familyRegistrations = registeredData ?? new Set<ArrayBuffer>()
      familyRegistrations.add(data)
      registrations.set(family, familyRegistrations)
      this.providerRegistrations.set(provider, registrations)
      this.registrationGeneration++
      return true
    } catch {
      return false
    }
  }

  /** Makes a face available to the page's own text, such as fields over canvas labels. */
  registerFontInBrowser(family: string, style: string, data: ArrayBuffer) {
    if (!IS_BROWSER) return
    const weight = styleToWeight(style)
    const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
    const face = new FontFace(family, data, {
      weight: String(weight),
      style: italic
    })
    face
      .load()
      .then(() => document.fonts.add(face))
      .catch(() => {
        console.warn(`Failed to load font "${family}" (${style})`)
      })
  }
}

export const fontManager = new FontManager()
