import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { DEFAULT_FONT_FAMILY, IS_BROWSER, GOOGLE_FONTS_API_KEY } from '#core/constants'
import type { SceneGraph } from '#core/scene-graph'
import { fontFallbackEntry } from '#core/text/fallbacks'
import type { FontFallbackScript } from '#core/text/fallbacks'

export interface FontInfo {
  family: string
  fullName: string
  style: string
  postscriptName: string
}

export type LocalFontAccessState = 'unsupported' | 'prompt' | 'granted' | 'denied'

export interface DownloadedFontCache {
  read(family: string, style: string): Promise<ArrayBuffer | null>
  write(family: string, style: string, data: ArrayBuffer): Promise<void>
}

type FindLocalFontOptions = { allowVariable?: boolean }

const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
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
  const s = style.toLowerCase().replace(/[\s-_]/g, '')
  if (s.includes('thin') || s.includes('hairline')) return 100
  if (s.includes('extralight') || s.includes('ultralight')) return 200
  if (s.includes('light')) return 300
  if (s.includes('medium')) return 500
  if (s.includes('semibold') || s.includes('demibold')) return 600
  if (s.includes('extrabold') || s.includes('ultrabold')) return 800
  if (s.includes('black') || s.includes('heavy')) return 900
  if (s.includes('bold')) return 700
  return 400
}

export function weightToStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = (FONT_WEIGHT_NAMES[rounded] ?? 'Regular').replace(/ /g, '')
  return italic ? `${label} Italic` : label
}

export class FontManager {
  private loadedFamilies = new Map<string, ArrayBuffer>()
  private fontProvider: TypefaceFontProvider | null = null
  private localFonts: FontInfo[] | null = null
  private localFontAccessState: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private downloadedFontCache: DownloadedFontCache | null = null
  private fallbackUserAgent: string | undefined
  private googleFontsCache = new Map<string, Record<string, string>>()
  private googleFontsFailed = new Set<string>()
  private cjkFallbackFamilies: string[] = []
  private cjkFallbackPromise: Promise<string[]> | null = null
  private arabicFallbackFamilies: string[] = []
  private arabicFallbackPromise: Promise<string[]> | null = null

  attachProvider(_canvasKit: CanvasKit, provider: TypefaceFontProvider): void {
    this.fontProvider = provider
    for (const [cacheKey, data] of this.loadedFamilies) {
      const family = cacheKey.slice(0, cacheKey.indexOf('|'))
      this.registerFontInCanvasKit(family, data)
    }
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
    const fonts = this.localFonts ?? (await this.requestLocalFontAccess())
    return [...new Set(fonts.map((f) => f.family))].sort()
  }

  async fetchBundledFont(url: string): Promise<ArrayBuffer | null> {
    if (IS_BROWSER) {
      const response = await fetch(url)
      return response.arrayBuffer()
    }
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url')
    const assetPath = fileURLToPath(new URL(`../../assets${url}`, import.meta.url))
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

    if (typeof fetch !== 'undefined') {
      try {
        const buffer = await this.fetchGoogleFont(family, style)
        if (buffer) {
          await this.writeDownloadedFont(family, style, buffer)
          return this.registerAndCache(family, style, buffer)
        }
      } catch (e) {
        console.warn(`Google Fonts fetch failed for "${family}" ${style}:`, e)
      }
    }

    const bundledUrl = BUNDLED_FONTS[cacheKey]
    if (bundledUrl) {
      try {
        const buffer = await this.fetchBundledFont(bundledUrl)
        if (buffer && !isVariableFont(buffer)) return this.registerAndCache(family, style, buffer)
      } catch (e) {
        console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
      }
    }

    return null
  }

  async ensureNodeFont(family: string, weight: number): Promise<void> {
    await this.loadFont(family, weightToStyle(weight))
  }

  markLoaded(family: string, style: string, data: ArrayBuffer): void {
    this.loadedFamilies.set(`${family}|${style}`, data)
    this.registerFontInCanvasKit(family, data)
  }

  isLoaded(family: string): boolean {
    return [...this.loadedFamilies.keys()].some((k) => k.startsWith(`${family}|`))
  }

  loadedData(family: string, style: string): ArrayBuffer | null {
    return this.loadedFamilies.get(`${family}|${style}`) ?? null
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
  ): Promise<Record<FontFallbackScript, string[]>> {
    const result: Record<FontFallbackScript, string[]> = { cjk: [], arabic: [] }
    await Promise.all(
      scripts.map(async (script) => {
        result[script] =
          script === 'cjk' ? await this.ensureCJKFallback() : await this.ensureArabicFallback()
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
      const buffer = await this.findLocalFont(family, undefined, {
        allowVariable: options.allowVariableLocalFonts
      })
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

  private async retryWithNormalizedFamily(family: string): Promise<Record<string, string> | null> {
    const normalized = normalizeFontFamily(family)
    if (normalized === family) {
      this.googleFontsFailed.add(family)
      return null
    }
    const result = await this.fetchGoogleFontFiles(normalized)
    if (result) this.googleFontsCache.set(family, result)
    else this.googleFontsFailed.add(family)
    return result
  }

  private async fetchGoogleFontFiles(family: string): Promise<Record<string, string> | null> {
    if (this.googleFontsCache.has(family)) return this.googleFontsCache.get(family) ?? null
    if (this.googleFontsFailed.has(family)) return null

    const url = `https://www.googleapis.com/webfonts/v1/webfonts?family=${encodeURIComponent(family)}&key=${GOOGLE_FONTS_API_KEY}`
    let response: Response
    try {
      response = await fetch(url)
    } catch {
      this.googleFontsFailed.add(family)
      return null
    }
    if (!response.ok) return this.retryWithNormalizedFamily(family)

    const data = (await response.json()) as {
      items?: Array<{ files?: Record<string, string> }>
    }
    const files = data.items?.[0]?.files
    if (!files) return this.retryWithNormalizedFamily(family)

    this.googleFontsCache.set(family, files)
    return files
  }

  private async fetchGoogleFont(family: string, style: string): Promise<ArrayBuffer | null> {
    const files = await this.fetchGoogleFontFiles(family)
    if (!files) return null

    const variant = styleToVariant(style)
    const ttfUrl = files[variant] ?? files['regular']
    if (!ttfUrl) return null

    const response = await fetch(ttfUrl)
    if (!response.ok) return null

    return response.arrayBuffer()
  }

  private async findLocalFont(
    family: string,
    style?: string,
    options: FindLocalFontOptions = {}
  ): Promise<ArrayBuffer | null> {
    if (!IS_BROWSER || !window.queryLocalFonts) return null
    try {
      const fonts = await window.queryLocalFonts()
      const families = [family]
      const normalized = normalizeFontFamily(family)
      if (normalized !== family) families.push(normalized)

      let match: (typeof fonts)[number] | undefined
      for (const f of families) {
        match = style ? fonts.find((x) => x.family === f && x.style === style) : undefined
        match ??= fonts.find((x) => x.family === f)
        if (match) break
      }

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
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
    return buffer
  }

  private registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
    if (!this.fontProvider || data.byteLength < 4) return false
    try {
      this.fontProvider.registerFont(data, family)
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
