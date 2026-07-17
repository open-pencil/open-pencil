import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY, IS_BROWSER } from '#core/constants'
import {
  chooseLocalFontMatch,
  isVariableFont,
  normalizeFontFamily,
  styleToWeight,
  weightToStyle
} from '#core/text/font-style'

export * from '#core/text/font-sources'
export * from '#core/text/font-style'
import { fontFallbackEntry } from '#core/text/fallbacks'
import type { FontFallbackScript } from '#core/text/fallbacks'
import type {
  DownloadedFontCache,
  FontFamilyOption,
  FontInfo,
  HostFontLoader,
  LocalFontAccessState
} from '#core/text/font-sources'
import { collectGraphFontKeys } from '#core/text/requirements'
import { normalizedCoverageText, WebFontResolver } from '#core/text/web-fonts'
import type { WebFontFetch, WebFontProviderId } from '#core/text/web-fonts'

type FindLocalFontOptions = { allowVariable?: boolean }

const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf'
}

export class FontManager {
  private loadedFamilies = new Map<string, ArrayBuffer>()
  private supplementalFamilyData = new Map<string, ArrayBuffer[]>()
  private remoteCoverage = new Map<string, Set<string>>()
  private blockedNodeIds = new Set<string>()
  private fontProvider: TypefaceFontProvider | null = null
  private registrationGeneration = 0
  private providerRegistrations = new Map<string, Set<ArrayBuffer>>()
  private localFonts: FontInfo[] | null = null
  private localFontAccessState: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private downloadedFontCache: DownloadedFontCache | null = null
  private fallbackUserAgent: string | undefined
  private hostFontLoader: HostFontLoader | null = null
  private webFonts = new WebFontResolver()
  private cjkFallbackFamilies: string[] = []
  private cjkFallbackPromise: Promise<string[]> | null = null
  private arabicFallbackFamilies: string[] = []
  private arabicFallbackPromise: Promise<string[]> | null = null

  attachProvider(_canvasKit: CanvasKit, provider: TypefaceFontProvider): void {
    this.fontProvider = provider
    this.registrationGeneration++
    this.providerRegistrations.clear()
    for (const [cacheKey, data] of this.loadedFamilies) {
      const separator = cacheKey.indexOf('|')
      const family = cacheKey.slice(0, separator)
      this.registerFontInCanvasKit(family, data)
      for (const supplemental of this.supplementalFamilyData.get(cacheKey) ?? []) {
        this.registerFontInCanvasKit(family, supplemental)
      }
    }
  }

  detachProvider(provider?: TypefaceFontProvider | null): void {
    if (!provider || this.fontProvider === provider) this.fontProvider = null
  }

  provider(): TypefaceFontProvider | null {
    return this.fontProvider
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
  }

  /** @deprecated Use setHostFontLoader. Scheduled for removal in v0.15. */
  setHostFallbackFontLoader(loader: HostFontLoader | null): void {
    this.setHostFontLoader(loader)
  }

  setOnlineFontProviders(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.webFonts.setEnabled(settings)
  }

  setWebFontFetch(fetcher: WebFontFetch | null): void {
    this.webFonts.setRemoteFetch(fetcher)
  }

  enabledOnlineFontProviders(): WebFontProviderId[] {
    return this.webFonts.enabledProviders()
  }

  async loadCachedFont(
    family: string,
    style = 'Regular',
    characters = ''
  ): Promise<ArrayBuffer | null> {
    const cached = await this.readDownloadedFont(family, style, characters)
    if (!cached) return null
    return this.registerAndCache(family, style, cached)
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

  preloadGoogleFamilies(): void {
    if (!this.webFonts.enabledProviders().includes('google')) return
    void this.webFonts.listFamilies('google')
  }

  async fetchBundledFont(url: string): Promise<ArrayBuffer | null> {
    if (IS_BROWSER) {
      const response = await fetch(url)
      return response.arrayBuffer()
    }
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
    const { resolve, dirname } = await import(/* @vite-ignore */ 'node:path')
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url')
    const packageJsonUrl = import.meta.resolve('@open-pencil/core/package.json')
    const packageRoot = dirname(fileURLToPath(packageJsonUrl))
    const assetPath = resolve(packageRoot, `assets${url}`)
    const buf = await readFile(assetPath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  async loadLocalFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
    const cacheKey = `${family}|${style}`
    const loaded = this.loadedFamilies.get(cacheKey)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      return loaded
    }

    const localBuffer =
      (await this.loadHostFont(family, style)) ?? (await this.findLocalFont(family, style))
    if (localBuffer) return this.registerAndCache(family, style, localBuffer)

    const bundledUrl = BUNDLED_FONTS[cacheKey]
    if (!bundledUrl) return null
    try {
      const buffer = await this.fetchBundledFont(bundledUrl)
      return buffer && !isVariableFont(buffer) ? this.registerAndCache(family, style, buffer) : null
    } catch (e) {
      console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  async loadRemoteFont(
    family: string,
    style = 'Regular',
    characters = ''
  ): Promise<ArrayBuffer | null> {
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
      const buffers = await this.webFonts.fetchFont(families, style, requestedCharacters)
      if (buffers.length === 0) return null
      const primary = buffers[0]
      await this.writeDownloadedFont(family, style, primary, requestedCharacters)
      const registered = this.registerAndCache(family, style, primary)
      const loadedCoverage = this.remoteCoverage.get(`${family}|${style}`) ?? new Set<string>()
      for (const character of requestedCharacters) loadedCoverage.add(character)
      this.remoteCoverage.set(`${family}|${style}`, loadedCoverage)
      for (const supplemental of buffers.slice(1)) {
        this.registerSupplemental(family, style, supplemental)
      }
      return registered
    } catch (e) {
      console.warn(`Web font fetch failed for "${family}" ${style}:`, e)
      return null
    }
  }

  async loadFont(family: string, style = 'Regular', characters = ''): Promise<ArrayBuffer | null> {
    const loaded = this.loadedData(family, style)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      const remoteCoverage = this.remoteCoverage.get(`${family}|${style}`)
      const missingRemoteCoverage = Boolean(
        characters &&
        remoteCoverage &&
        Array.from(characters).some((character) => !remoteCoverage.has(character))
      )
      return missingRemoteCoverage
        ? ((await this.loadRemoteFont(family, style, characters)) ?? loaded)
        : loaded
    }

    return (
      (await this.loadLocalFont(family, style)) ??
      (await this.loadCachedFont(family, style, characters)) ??
      (await this.loadRemoteFont(family, style, characters))
    )
  }

  async ensureNodeFont(family: string, weight: number): Promise<void> {
    await this.loadFont(family, weightToStyle(weight))
  }

  markLoaded(family: string, style: string, data: ArrayBuffer): void {
    this.registerAndCache(family, style, data)
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

  renderFamily(family: string, _style: string): string {
    // CanvasKit can shape metrics but paint no glyphs for some CJK/Arabic faces registered under a
    // synthetic alias. Keep every shard under the font's source family; character-aware remote
    // requests already fetch cumulative coverage before replacing the primary buffer.
    return family
  }

  collectFontKeys(graph: SceneGraph, nodeIds: string[]): Array<[string, string]> {
    return collectGraphFontKeys(graph, nodeIds)
  }

  async ensureCJKFallback(): Promise<string[]> {
    if (this.cjkFallbackFamilies.length > 0) return this.cjkFallbackFamilies
    if (this.cjkFallbackPromise) return this.cjkFallbackPromise

    this.cjkFallbackPromise = this.ensureFallbackFamilies('cjk', this.cjkFallbackFamilies, {
      allowVariableLocalFonts: true
    })
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

  async ensureFallbackPack(
    scripts: FontFallbackScript[] = ['cjk', 'arabic'],
    characters = ''
  ): Promise<Partial<Record<FontFallbackScript, string[]>>> {
    const result: Partial<Record<FontFallbackScript, string[]>> = {}
    await Promise.all(
      scripts.map(async (script) => {
        if (script === 'arabic' && !characters) result[script] = await this.ensureArabicFallback()
        else if (script === 'cjk' && !characters) result[script] = await this.ensureCJKFallback()
        else {
          const target =
            script === 'arabic' ? this.arabicFallbackFamilies : this.cjkFallbackFamilies
          result[script] = await this.ensureFallbackFamilies(script, target, {}, characters)
        }
      })
    )
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
    options: { allowVariableLocalFonts?: boolean } = {},
    characters = ''
  ): Promise<string[]> {
    const manifest = fontFallbackEntry(script, this.fallbackUserAgent)

    for (const family of manifest.localFamilies) {
      const buffer =
        (await this.loadHostFont(family, 'Regular')) ??
        (await this.findLocalFont(family, undefined, {
          allowVariable: options.allowVariableLocalFonts
        }))
      if (
        buffer &&
        this.registerAndCache(family, 'Regular', buffer) &&
        !targetFamilies.includes(family)
      ) {
        targetFamilies.push(family)
      }
    }

    if (targetFamilies.length === 0 || characters) {
      const results = await Promise.allSettled(
        manifest.remoteFamilies.map(async (family) => {
          const data = await this.loadRemoteFont(family, 'Regular', characters)
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

  private async loadHostFont(family: string, style: string): Promise<ArrayBuffer | null> {
    if (!this.hostFontLoader) return null
    try {
      return await this.hostFontLoader(family, style)
    } catch (e) {
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

  private async findLocalFont(
    family: string,
    style?: string,
    options: FindLocalFontOptions = {}
  ): Promise<ArrayBuffer | null> {
    if (!IS_BROWSER || !window.queryLocalFonts) return null
    if (this.localFontAccessState !== 'granted') return null
    try {
      const fonts = await window.queryLocalFonts()
      const match = chooseLocalFontMatch(fonts, family, style)
      if (!match) return null
      const blob: Blob = await match.blob()
      const buffer = await blob.arrayBuffer()
      if (!options.allowVariable && isVariableFont(buffer)) return null
      return buffer
    } catch (e) {
      console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
      return null
    }
  }

  private registerSupplemental(family: string, style: string, buffer: ArrayBuffer): void {
    const key = `${family}|${style}`
    const supplemental = this.supplementalFamilyData.get(key) ?? []
    if (supplemental.includes(buffer)) return
    supplemental.push(buffer)
    this.supplementalFamilyData.set(key, supplemental)
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
  }

  private registerAndCache(family: string, style: string, buffer: ArrayBuffer): ArrayBuffer | null {
    const key = `${family}|${style}`
    const existing = this.loadedFamilies.get(key)
    if (existing === buffer) {
      this.registerFontInCanvasKit(family, buffer)
      return buffer
    }
    if (existing) this.registerSupplemental(family, style, existing)
    this.loadedFamilies.set(key, buffer)
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
    return buffer
  }

  private registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
    if (!this.fontProvider || data.byteLength < 4) return false
    const registeredData = this.providerRegistrations.get(family)
    if (registeredData?.has(data)) return true
    try {
      this.fontProvider.registerFont(data, family)
      const familyRegistrations = registeredData ?? new Set<ArrayBuffer>()
      familyRegistrations.add(data)
      this.providerRegistrations.set(family, familyRegistrations)
      this.registrationGeneration++
      return true
    } catch {
      return false
    }
  }

  private registerFontInBrowser(family: string, style: string, data: ArrayBuffer) {
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
