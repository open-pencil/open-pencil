import {
  DEFAULT_FONT_FAMILY,
  IS_BROWSER,
  CJK_FALLBACK_FAMILIES_MACOS,
  CJK_FALLBACK_FAMILIES_WINDOWS,
  CJK_FALLBACK_FAMILIES_LINUX,
  CJK_GOOGLE_FONTS,
  GOOGLE_FONTS_API_KEY
} from '../constants'

import type { SceneGraph } from '../scene-graph'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

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

async function queryFonts(): Promise<FontInfo[]> {
  if (!IS_BROWSER || !window.queryLocalFonts) return []
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
  'Inter|Regular': '/Inter-Regular.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf'
}

const googleFontsCache = new Map<string, Record<string, string>>()
const googleFontsFailed = new Set<string>()

export function normalizeFontFamily(family: string): string {
  return family.replace(/\s+(Variable|\d+(?:pt|px|em))$/i, '')
}

async function retryWithNormalizedFamily(family: string): Promise<Record<string, string> | null> {
  const normalized = normalizeFontFamily(family)
  if (normalized === family) {
    googleFontsFailed.add(family)
    return null
  }
  const result = await fetchGoogleFontFiles(normalized)
  if (result) googleFontsCache.set(family, result)
  else googleFontsFailed.add(family)
  return result
}

async function fetchGoogleFontFiles(family: string): Promise<Record<string, string> | null> {
  if (googleFontsCache.has(family)) return googleFontsCache.get(family) ?? null
  if (googleFontsFailed.has(family)) return null

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?family=${encodeURIComponent(family)}&key=${GOOGLE_FONTS_API_KEY}`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    googleFontsFailed.add(family)
    return null
  }
  if (!response.ok) return retryWithNormalizedFamily(family)

  const data = (await response.json()) as { items?: Array<{ files?: Record<string, string> }> }
  const files = data.items?.[0]?.files
  if (!files) return retryWithNormalizedFamily(family)

  googleFontsCache.set(family, files)
  return files
}

export function styleToVariant(style: string): string {
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

async function findLocalFont(family: string, style?: string): Promise<ArrayBuffer | null> {
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
    // Variable fonts (fvar table) cause CanvasKit to render all text at the
    // default weight. Skip them — Google Fonts serves per-weight static files.
    if (isVariableFont(buffer)) return null
    return buffer
  } catch (e) {
    console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
    return null
  }
}

export async function fetchBundledFont(url: string): Promise<ArrayBuffer | null> {
  if (IS_BROWSER) {
    const response = await fetch(url)
    return response.arrayBuffer()
  }
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const assetPath = fileURLToPath(new URL(`../../assets${url}`, import.meta.url))
  const buf = await readFile(assetPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function registerAndCache(family: string, style: string, buffer: ArrayBuffer): ArrayBuffer | null {
  if (!registerFontInCanvasKit(family, buffer)) return null
  loadedFamilies.set(`${family}|${style}`, buffer)
  registerFontInBrowser(family, style, buffer)
  return buffer
}

export async function loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  const cacheKey = `${family}|${style}`
  if (loadedFamilies.has(cacheKey)) {
    const cached = loadedFamilies.get(cacheKey)
    if (!cached) return null
    registerFontInCanvasKit(family, cached)
    return cached
  }

  const localBuffer = await findLocalFont(family, style)
  if (localBuffer) return registerAndCache(family, style, localBuffer)

  if (typeof fetch !== 'undefined') {
    try {
      const buffer = await fetchGoogleFont(family, style)
      if (buffer) return registerAndCache(family, style, buffer)
    } catch (e) {
      console.warn(`Google Fonts fetch failed for "${family}" ${style}:`, e)
    }
  }

  const bundledUrl = BUNDLED_FONTS[cacheKey]
  if (bundledUrl) {
    try {
      const buffer = await fetchBundledFont(bundledUrl)
      if (buffer && !isVariableFont(buffer)) return registerAndCache(family, style, buffer)
    } catch (e) {
      console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
    }
  }

  return null
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

  return [...fontKeys].map((k) => k.split('\0') as [string, string])
}

const cjkFallbackFamilies: string[] = []
let cjkFallbackPromise: Promise<string[]> | null = null
const arabicFallbackFamilies: string[] = []
let arabicFallbackPromise: Promise<string[]> | null = null

function getCJKCandidates(): string[] {
  if (typeof navigator === 'undefined') return [...CJK_FALLBACK_FAMILIES_LINUX]
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return CJK_FALLBACK_FAMILIES_MACOS
  if (ua.includes('Windows')) return CJK_FALLBACK_FAMILIES_WINDOWS
  return CJK_FALLBACK_FAMILIES_LINUX
}

export async function ensureCJKFallback(): Promise<string[]> {
  if (cjkFallbackFamilies.length > 0) return cjkFallbackFamilies
  if (cjkFallbackPromise) return cjkFallbackPromise

  cjkFallbackPromise = (async () => {
    // Try local system fonts first
    for (const family of getCJKCandidates()) {
      const buffer = await findLocalFont(family)
      if (buffer && registerAndCache(family, 'Regular', buffer)) {
        cjkFallbackFamilies.push(family)
      }
    }

    // Load all CJK Google Fonts in parallel for full coverage
    if (cjkFallbackFamilies.length === 0) {
      const results = await Promise.allSettled(
        CJK_GOOGLE_FONTS.map(async (family) => {
          const data = await loadFont(family, 'Regular')
          return data ? family : null
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          cjkFallbackFamilies.push(result.value)
        }
      }
    }

    return cjkFallbackFamilies
  })()

  return cjkFallbackPromise
}

/** @deprecated Use getCJKFallbackFamilies() instead */
export function getCJKFallbackFamily(): string | null {
  return cjkFallbackFamilies[0] ?? null
}

export function getCJKFallbackFamilies(): string[] {
  return cjkFallbackFamilies
}

export function setCJKFallbackFamily(family: string): void {
  if (!cjkFallbackFamilies.includes(family)) {
    cjkFallbackFamilies.push(family)
  }
}

export async function ensureArabicFallback(): Promise<string[]> {
  if (arabicFallbackFamilies.length > 0) return arabicFallbackFamilies
  if (arabicFallbackPromise) return arabicFallbackPromise

  arabicFallbackPromise = (async () => {
    for (const family of [
      'Noto Naskh Arabic',
      'Noto Sans Arabic',
      'Geeza Pro',
      'Arial',
      'Tahoma',
      'Amiri'
    ]) {
      const buffer = await findLocalFont(family)
      if (buffer && registerAndCache(family, 'Regular', buffer)) {
        arabicFallbackFamilies.push(family)
      }
    }

    if (arabicFallbackFamilies.length === 0) {
      const data = await loadFont('Noto Naskh Arabic', 'Regular')
      if (data) arabicFallbackFamilies.push('Noto Naskh Arabic')
    }

    return arabicFallbackFamilies
  })()

  return arabicFallbackPromise
}

export function getArabicFallbackFamilies(): string[] {
  return arabicFallbackFamilies
}

export function setArabicFallbackFamily(family: string): void {
  if (!arabicFallbackFamilies.includes(family)) {
    arabicFallbackFamilies.push(family)
  }
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

export function weightToStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = (FONT_WEIGHT_NAMES[rounded] ?? 'Regular').replace(/ /g, '')
  return italic ? `${label} Italic` : label
}
