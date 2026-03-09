import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import {
  DEFAULT_FONT_FAMILY,
  CJK_FALLBACK_FAMILIES_MACOS,
  CJK_FALLBACK_FAMILIES_WINDOWS,
  CJK_FALLBACK_FAMILIES_LINUX,
  CJK_GOOGLE_FONT,
  GOOGLE_FONTS_API_KEY
} from './constants'
import type { SceneGraph } from './scene-graph'

export interface FontInfo {
  family: string
  fullName: string
  style: string
  postscriptName: string
}

const loadedFamilies = new Map<string, ArrayBuffer>()
let fontProvider: TypefaceFontProvider | null = null

export function initFontService(_canvasKit: CanvasKit, provider: TypefaceFontProvider) {
  fontProvider = provider
}

export function getFontProvider(): TypefaceFontProvider | null {
  return fontProvider
}

export async function queryFonts(): Promise<FontInfo[]> {
  if (typeof window === 'undefined' || !window.queryLocalFonts) return []
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
    return result
  } catch {
    return []
  }
}

export async function listFamilies(): Promise<string[]> {
  const fonts = await queryFonts()
  return [...new Set(fonts.map((f) => f.family))].sort()
}

const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf'
}

const googleFontsCache = new Map<string, Record<string, string>>()
const googleFontsFailed = new Set<string>()

function normalizeFontFamily(family: string): string {
  return family.replace(/\s+Variable$/i, '')
}

async function fetchGoogleFontFiles(family: string): Promise<Record<string, string> | null> {
  if (googleFontsCache.has(family)) return googleFontsCache.get(family)!
  if (googleFontsFailed.has(family)) return null

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?family=${encodeURIComponent(family)}&key=${GOOGLE_FONTS_API_KEY}`
  const response = await fetch(url)
  if (!response.ok) {
    const normalized = normalizeFontFamily(family)
    if (normalized !== family) {
      const result = await fetchGoogleFontFiles(normalized)
      if (result) googleFontsCache.set(family, result)
      else googleFontsFailed.add(family)
      return result
    }
    googleFontsFailed.add(family)
    return null
  }

  const data = (await response.json()) as { items?: Array<{ files?: Record<string, string> }> }
  const files = data.items?.[0]?.files
  if (!files) {
    const normalized = normalizeFontFamily(family)
    if (normalized !== family) {
      const result = await fetchGoogleFontFiles(normalized)
      if (result) googleFontsCache.set(family, result)
      else googleFontsFailed.add(family)
      return result
    }
    googleFontsFailed.add(family)
    return null
  }

  googleFontsCache.set(family, files)
  return files
}

function styleToVariant(style: string): string {
  const weight = styleToWeight(style)
  const italic = style.toLowerCase().includes('italic')
  if (weight === 400 && !italic) return 'regular'
  if (weight === 400 && italic) return 'italic'
  return italic ? `${weight}italic` : `${weight}`
}

async function fetchGoogleFont(family: string, style: string): Promise<ArrayBuffer | null> {
  const files = await fetchGoogleFontFiles(family)
  if (!files) return null

  const variant = styleToVariant(style)
  const ttfUrl = files[variant] ?? files['regular']
  if (!ttfUrl) return null

  const response = await fetch(ttfUrl)
  if (!response.ok) return null

  return response.arrayBuffer()
}

export async function loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  const cacheKey = `${family}|${style}`
  if (loadedFamilies.has(cacheKey)) {
    const cached = loadedFamilies.get(cacheKey)
    if (!cached) return null
    registerFontInCanvasKit(family, cached)
    return cached
  }

  // Try local font access API first (browser only)
  if (window.queryLocalFonts) {
    try {
      const fonts = await window.queryLocalFonts()
      const normalized = normalizeFontFamily(family)
      const match =
        fonts.find((f: FontInfo) => f.family === family && f.style === style) ??
        fonts.find((f: FontInfo) => f.family === family) ??
        (normalized !== family
          ? (fonts.find((f: FontInfo) => f.family === normalized && f.style === style) ??
            fonts.find((f: FontInfo) => f.family === normalized))
          : undefined)
      if (match) {
        const blob: Blob = await match.blob()
        const buffer = await blob.arrayBuffer()

        if (registerFontInCanvasKit(family, buffer)) {
          loadedFamilies.set(cacheKey, buffer)
          registerFontInBrowser(family, style, buffer)
          return buffer
        }
      }
    } catch {
      /* fall through to Google Fonts */
    }
  }

  // Try Google Fonts
  if (typeof fetch !== 'undefined') {
    try {
      const buffer = await fetchGoogleFont(family, style)
      if (buffer && registerFontInCanvasKit(family, buffer)) {
        loadedFamilies.set(cacheKey, buffer)
        registerFontInBrowser(family, style, buffer)
        return buffer
      }
    } catch {
      /* fall through to bundled */
    }
  }

  // Fall back to bundled font
  const bundledUrl = BUNDLED_FONTS[cacheKey]
  if (bundledUrl) {
    try {
      const response = await fetch(bundledUrl)
      const buffer = await response.arrayBuffer()

      if (registerFontInCanvasKit(family, buffer)) {
        loadedFamilies.set(cacheKey, buffer)
        registerFontInBrowser(family, style, buffer)
        return buffer
      }
    } catch {
      /* no bundled font available */
    }
  }

  return null
}

function registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
  if (!fontProvider || data.byteLength < 4) return false
  try {
    fontProvider.registerFont(data, family)
    return true
  } catch {
    return false
  }
}

function registerFontInBrowser(family: string, style: string, data: ArrayBuffer) {
  if (typeof document === 'undefined') return
  const weight = styleToWeight(style)
  const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
  const face = new FontFace(family, data, {
    weight: String(weight),
    style: italic
  })
  face.load().then(() => document.fonts.add(face)).catch(() => {
    console.warn(`Failed to load font "${family}" (${style})`)
  })
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

export async function ensureNodeFont(family: string, weight: number): Promise<void> {
  const style = weightToStyle(weight)
  await loadFont(family, style)
}

export function markFontLoaded(family: string, style: string, data: ArrayBuffer): void {
  const cacheKey = `${family}|${style}`
  loadedFamilies.set(cacheKey, data)
  registerFontInCanvasKit(family, data)
}

export function isFontLoaded(family: string): boolean {
  return [...loadedFamilies.keys()].some((k) => k.startsWith(`${family}|`))
}

export function getLoadedFontData(family: string, style: string): ArrayBuffer | null {
  return loadedFamilies.get(`${family}|${style}`) ?? null
}

export function collectFontKeys(graph: SceneGraph, nodeIds: string[]): Array<[string, string]> {
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

  return [...fontKeys]
    .map((k) => k.split('\0') as [string, string])
    .filter(([family]) => family !== DEFAULT_FONT_FAMILY)
}

let cjkFallbackFamily: string | null = null
let cjkFallbackPromise: Promise<string | null> | null = null

function getCJKCandidates(): string[] {
  if (typeof navigator === 'undefined') return [...CJK_FALLBACK_FAMILIES_LINUX]
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return CJK_FALLBACK_FAMILIES_MACOS
  if (ua.includes('Windows')) return CJK_FALLBACK_FAMILIES_WINDOWS
  return CJK_FALLBACK_FAMILIES_LINUX
}

async function tryLoadLocalFont(family: string): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || !window.queryLocalFonts) return null
  try {
    const fonts = await window.queryLocalFonts()
    const match = fonts.find((f: FontInfo) => f.family === family)
    if (!match) return null
    const blob: Blob = await match.blob()
    const buffer = await blob.arrayBuffer()
    if (!registerFontInCanvasKit(family, buffer)) return null
    const cacheKey = `${family}|Regular`
    loadedFamilies.set(cacheKey, buffer)
    registerFontInBrowser(family, 'Regular', buffer)
    return buffer
  } catch {
    return null
  }
}

export async function ensureCJKFallback(): Promise<string | null> {
  if (cjkFallbackFamily) return cjkFallbackFamily
  if (cjkFallbackPromise) return cjkFallbackPromise

  cjkFallbackPromise = (async () => {
    for (const family of getCJKCandidates()) {
      if (await tryLoadLocalFont(family)) {
        cjkFallbackFamily = family
        return family
      }
    }

    const data = await loadFont(CJK_GOOGLE_FONT, 'Regular')
    if (data) {
      cjkFallbackFamily = CJK_GOOGLE_FONT
      return CJK_GOOGLE_FONT
    }

    return null
  })()

  return cjkFallbackPromise
}

export function getCJKFallbackFamily(): string | null {
  return cjkFallbackFamily
}

export function weightToStyle(weight: number, italic = false): string {
  let label = 'Regular'
  if (weight <= 100) label = 'Thin'
  else if (weight <= 200) label = 'ExtraLight'
  else if (weight <= 300) label = 'Light'
  else if (weight <= 500) label = 'Medium'
  else if (weight <= 600) label = 'SemiBold'
  else if (weight <= 700) label = 'Bold'
  else if (weight <= 800) label = 'ExtraBold'
  else if (weight >= 900) label = 'Black'
  if (italic) label += ' Italic'
  return label
}
