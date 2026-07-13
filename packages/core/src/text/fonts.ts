import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY, IS_BROWSER } from '#core/constants'
import { fontFaceRenderFamily, parseFontStyle } from '#core/text/face'
import { fontFallbackEntry } from '#core/text/fallbacks'
import type { FontFallbackScript } from '#core/text/fallbacks'
import { WebFontResolver } from '#core/text/web-fonts'
import type { WebFontFetch, WebFontProviderId } from '#core/text/web-fonts'

export interface FontInfo {
  family: string
  fullName: string
  style: string
  postscriptName: string
}

export type LocalFontAccessState = 'unsupported' | 'prompt' | 'granted' | 'denied'
export type FontFamilySource = 'local' | 'bundled' | 'fallback' | WebFontProviderId

export interface FontFamilyOption {
  family: string
  source: FontFamilySource
}

export interface DownloadedFontCache {
  read(family: string, style: string): Promise<ArrayBuffer | null>
  write(family: string, style: string, data: ArrayBuffer): Promise<void>
}

export type HostFontLoader = (family: string, style: string) => Promise<ArrayBuffer | null>

type FindLocalFontOptions = { allowVariable?: boolean }

type LocalFontMatch = Pick<FontInfo, 'family' | 'style'>

export function chooseLocalFontMatch<T extends LocalFontMatch>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  const families = [family]
  const normalized = normalizeFontFamily(family)
  if (normalized !== family) families.push(normalized)
  const requested = parseFontStyle(style)

  for (const f of families) {
    const exact = style ? fonts.find((x) => x.family === f && x.style === style) : undefined
    if (exact) return exact

    const candidates = fonts.filter((x) => x.family === f)
    const sameStyle = candidates.find((x) => {
      const parsed = parseFontStyle(x.style)
      return parsed.weight === requested.weight && parsed.italic === requested.italic
    })
    if (sameStyle) return sameStyle

    if (style) continue

    const sameSlant = candidates.filter((x) => parseFontStyle(x.style).italic === requested.italic)
    if (sameSlant.length > 0) return sameSlant[0]

    if (candidates.length > 0) return candidates[0]
  }

  return undefined
}

const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf'
}

export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
}

export function normalizeFontFamily(family: string): string {
  return family.replace(/\s+(Variable|\d+(?:pt|px|em))$/i, '')
}

export function styleToVariant(style: string): string {
  const weight = styleToWeight(style)
  const italic = style.toLowerCase().includes('italic')
  if (weight === 400 && !italic) return 'regular'
  if (weight === 400 && italic) return 'italic'
  return italic ? `${weight}italic` : `${weight}`
}

export function isVariableFont(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const view = new DataView(data)
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables && 12 + i * 16 + 4 <= data.byteLength; i++) {
    const tag = String.fromCharCode(
      view.getUint8(12 + i * 16),
      view.getUint8(12 + i * 16 + 1),
      view.getUint8(12 + i * 16 + 2),
      view.getUint8(12 + i * 16 + 3)
    )
    if (tag === 'fvar') return true
  }
  return false
}

export function styleToWeight(style: string): number {
  return parseFontStyle(style).weight
}

export function weightToStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = (FONT_WEIGHT_NAMES[rounded] ?? 'Regular').replace(/ /g, '')
  return italic ? `${label} Italic` : label
}

export function weightToFigmaStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = FONT_WEIGHT_NAMES[rounded] ?? 'Regular'
  return italic ? `${label} Italic` : label
}

/** Distinct family|style pairs used by a TEXT node (base + style runs). */
export function collectTextNodeFontStyles(
  node: Pick<SceneNode, 'fontFamily' | 'fontWeight' | 'italic' | 'styleRuns'>
): Array<[string, string]> {
  const keys = new Set<string>()
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  keys.add(`${baseFamily}\0${weightToStyle(node.fontWeight || 400, node.italic)}`)
  for (const run of node.styleRuns ?? []) {
    const family = run.style.fontFamily ?? baseFamily
    const weight = run.style.fontWeight ?? node.fontWeight ?? 400
    const italic = run.style.italic ?? node.italic
    keys.add(`${family}\0${weightToStyle(weight, italic)}`)
  }
  return [...keys].map((k) => k.split('\0') as [string, string])
}

export class FontManager {
  private loadedFamilies = new Map<string, ArrayBuffer>()
  private fontProvider: TypefaceFontProvider | null = null
  private localFonts: FontInfo[] | null = null
  private localFontAccessState: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private downloadedFontCache: DownloadedFontCache | null = null
  private fallbackUserAgent: string | undefined
  private hostFallbackFontLoader: HostFontLoader | null = null
  private webFonts = new WebFontResolver()
  private registeredRenderFamilies = new Set<string>()
  private cjkFallbackFamilies: string[] = []
  private cjkFallbackPromise: Promise<string[]> | null = null
  private arabicFallbackFamilies: string[] = []
  private arabicFallbackPromise: Promise<string[]> | null = null

  attachProvider(_canvasKit: CanvasKit, provider: TypefaceFontProvider): void {
    this.fontProvider = provider
    this.reregisterAllOnProvider()
  }

  /**
   * Bind the manager to the renderer’s live TypefaceFontProvider.
   * Paragraph building must use the same provider instance fonts are registered on.
   */
  bindProvider(canvasKit: CanvasKit, provider: TypefaceFontProvider | null): void {
    if (!provider) return
    if (this.fontProvider === provider) return
    this.attachProvider(canvasKit, provider)
  }

  detachProvider(provider?: TypefaceFontProvider | null): void {
    if (!provider || this.fontProvider === provider) this.fontProvider = null
  }

  provider(): TypefaceFontProvider | null {
    return this.fontProvider
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

  setHostFallbackFontLoader(loader: HostFontLoader | null): void {
    this.hostFallbackFontLoader = loader
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

  async loadCachedFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
    const cached = await this.readDownloadedFont(family, style)
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

  async loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
    const cacheKey = `${family}|${style}`
    if (this.loadedFamilies.has(cacheKey)) {
      const cached = this.loadedFamilies.get(cacheKey)
      if (!cached) return null
      this.registerFontInCanvasKit(family, cached)
      return cached
    }

    const downloadedBuffer = await this.loadCachedFont(family, style)
    if (downloadedBuffer) return downloadedBuffer

    const localBuffer = await this.findLocalFont(family, style)
    if (localBuffer) return this.registerAndCache(family, style, localBuffer)

    const bundledUrl = BUNDLED_FONTS[cacheKey]
    if (bundledUrl) {
      try {
        const buffer = await this.fetchBundledFont(bundledUrl)
        if (buffer && !isVariableFont(buffer)) return this.registerAndCache(family, style, buffer)
      } catch (e) {
        console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
      }
    }

    if (typeof fetch !== 'undefined') {
      try {
        const normalized = normalizeFontFamily(family)
        const families = normalized === family ? [family] : [family, normalized]
        const buffer = await this.webFonts.fetchFont(families, style)
        if (buffer) {
          await this.writeDownloadedFont(family, style, buffer)
          return this.registerAndCache(family, style, buffer)
        }
      } catch (e) {
        console.warn(`Web font fetch failed for "${family}" ${style}:`, e)
      }
    }

    return null
  }

  async ensureNodeFont(family: string, weight: number): Promise<void> {
    await this.loadFont(family, weightToStyle(weight))
  }

  /**
   * Load and register every face used by a TEXT node (base + style runs)
   * onto the active CanvasKit provider so live paragraph/edit paint can use them.
   */
  async ensureTextNodeFonts(
    node: Pick<
      SceneNode,
      'type' | 'fontFamily' | 'fontWeight' | 'italic' | 'styleRuns' | 'text'
    >,
    renderer?: { ck: CanvasKit; fontProvider: TypefaceFontProvider | null } | null
  ): Promise<void> {
    if (node.type !== 'TEXT') return
    if (renderer?.fontProvider) this.bindProvider(renderer.ck, renderer.fontProvider)

    const styles = collectTextNodeFontStyles(node)
    await Promise.all(styles.map(([family, style]) => this.loadFont(family, style)))
    for (const [family, style] of styles) {
      // Force synthetic style registration for paragraph fontFamilies lists.
      this.renderFamily(family, style)
    }
  }

  markLoaded(family: string, style: string, data: ArrayBuffer): void {
    this.loadedFamilies.set(`${family}|${style}`, data)
    this.registerStyleOnProvider(family, style, data)
  }

  isLoaded(family: string): boolean {
    return [...this.loadedFamilies.keys()].some((k) => k.startsWith(`${family}|`))
  }

  isStyleLoaded(family: string, style: string): boolean {
    return this.loadedFamilies.has(`${family}|${style}`)
  }

  loadedData(family: string, style: string): ArrayBuffer | null {
    return this.loadedFamilies.get(`${family}|${style}`) ?? null
  }

  renderFamily(family: string, style: string): string {
    const data = this.loadedData(family, style)
    if (!data) return family

    const renderFamily = fontFaceRenderFamily(family, style)
    if (!this.registeredRenderFamilies.has(renderFamily)) {
      if (this.registerFontInCanvasKit(renderFamily, data)) {
        this.registeredRenderFamilies.add(renderFamily)
      } else {
        return family
      }
    }
    return renderFamily
  }

  /** Re-register every cached face (family + style-specific render name) on the current provider. */
  private reregisterAllOnProvider(): void {
    this.registeredRenderFamilies.clear()
    for (const [cacheKey, data] of this.loadedFamilies) {
      const sep = cacheKey.indexOf('|')
      if (sep < 0) continue
      const family = cacheKey.slice(0, sep)
      const style = cacheKey.slice(sep + 1)
      this.registerStyleOnProvider(family, style, data)
    }
  }

  private registerStyleOnProvider(family: string, style: string, data: ArrayBuffer): void {
    this.registerFontInCanvasKit(family, data)
    const renderName = fontFaceRenderFamily(family, style)
    if (this.registerFontInCanvasKit(renderName, data)) {
      this.registeredRenderFamilies.add(renderName)
    }
  }

  collectFontKeys(graph: SceneGraph, nodeIds: string[]): Array<[string, string]> {
    const fontKeys = new Set<string>()
    const collect = (id: string) => {
      const node = graph.getNode(id)
      if (!node) return
      if (node.type === 'TEXT') {
        const family = node.fontFamily || DEFAULT_FONT_FAMILY
        fontKeys.add(`${family}\0${weightToStyle(node.fontWeight || 400, node.italic)}`)
        for (const run of node.styleRuns) {
          const f = run.style.fontFamily ?? family
          const w = run.style.fontWeight ?? node.fontWeight
          const i = run.style.italic ?? node.italic
          fontKeys.add(`${f}\0${weightToStyle(w, i)}`)
        }
      }
      for (const childId of node.childIds) collect(childId)
    }
    for (const id of nodeIds) collect(id)

    return [...fontKeys].map((k) => k.split('\0') as [string, string])
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
    scripts: FontFallbackScript[] = ['cjk', 'arabic']
  ): Promise<Partial<Record<FontFallbackScript, string[]>>> {
    const result: Partial<Record<FontFallbackScript, string[]>> = {}
    await Promise.all(
      scripts.map(async (script) => {
        if (script === 'arabic') result[script] = await this.ensureArabicFallback()
        else if (script === 'cjk') result[script] = await this.ensureCJKFallback()
        else result[script] = await this.ensureFallbackFamilies(script, this.cjkFallbackFamilies)
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
    options: { allowVariableLocalFonts?: boolean } = {}
  ): Promise<string[]> {
    const manifest = fontFallbackEntry(script, this.fallbackUserAgent)

    for (const family of manifest.localFamilies) {
      const buffer =
        (await this.loadHostFallbackFont(family, 'Regular')) ??
        (await this.findLocalFont(family, undefined, {
          allowVariable: options.allowVariableLocalFonts
        }))
      if (buffer && this.registerAndCache(family, 'Regular', buffer)) {
        targetFamilies.push(family)
      }
    }

    if (targetFamilies.length === 0) {
      const results = await Promise.allSettled(
        manifest.remoteFamilies.map(async (family) => {
          const data = await this.loadFont(family, 'Regular')
          return data ? family : null
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) targetFamilies.push(result.value)
      }
    }

    return targetFamilies
  }

  private async loadHostFallbackFont(family: string, style: string): Promise<ArrayBuffer | null> {
    if (!this.hostFallbackFontLoader) return null
    try {
      return await this.hostFallbackFontLoader(family, style)
    } catch (e) {
      console.warn(`Host fallback font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async readDownloadedFont(family: string, style: string): Promise<ArrayBuffer | null> {
    if (!this.downloadedFontCache) return null
    try {
      return await this.downloadedFontCache.read(family, style)
    } catch (e) {
      console.warn(`Downloaded font cache read failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async writeDownloadedFont(
    family: string,
    style: string,
    data: ArrayBuffer
  ): Promise<void> {
    if (!this.downloadedFontCache) return
    try {
      await this.downloadedFontCache.write(family, style, data)
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

  private registerAndCache(family: string, style: string, buffer: ArrayBuffer): ArrayBuffer | null {
    this.loadedFamilies.set(`${family}|${style}`, buffer)
    this.registerStyleOnProvider(family, style, buffer)
    this.registerFontInBrowser(family, style, buffer)
    return buffer
  }

  private registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
    if (!this.fontProvider || data.byteLength < 4) return false
    try {
      // Copy so WASM / FontFace consumers cannot detach the cached buffer.
      this.fontProvider.registerFont(data.slice(0), family)
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
