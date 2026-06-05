import { useLocalStorage } from '@vueuse/core'

import type { SceneGraph } from '@open-pencil/core/scene-graph'
import {
  fontManager,
  styleToWeight,
  type FontFamilyOption,
  type LocalFontAccessState
} from '@open-pencil/core/text'

import {
  clearDownloadedFontCache as clearTauriDownloadedFontCache,
  createTauriDownloadedFontCache,
  downloadedFontCacheSummary as tauriDownloadedFontCacheSummary
} from '@/app/editor/fonts/cache'
import { isTauri } from '@/app/tauri/env'

if (typeof navigator !== 'undefined') {
  fontManager.setFallbackUserAgent(navigator.userAgent)
}

export const googleFontsEnabled = useLocalStorage('op-google-fonts-enabled', true)

let tauriFontCacheConfigured = false

function configureTauriFontCache() {
  if (tauriFontCacheConfigured || !isTauri()) return
  tauriFontCacheConfigured = true
  fontManager.setDownloadedFontCache(createTauriDownloadedFontCache())
}

configureTauriFontCache()

interface TauriFontFamily {
  family: string
  styles: string[]
}

let tauriFontsCache: TauriFontFamily[] | null = null
let tauriFontsPromise: Promise<TauriFontFamily[]> | null = null

const CJK_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/u
const ARABIC_TEXT_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u

async function getTauriFonts(): Promise<TauriFontFamily[]> {
  if (tauriFontsCache) return tauriFontsCache
  if (!tauriFontsPromise) {
    tauriFontsPromise = import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<TauriFontFamily[]>('list_system_fonts'))
      .then((fonts) => {
        tauriFontsCache = fonts
        return fonts
      })
      .catch(() => [])
  }
  return tauriFontsPromise
}

export function preloadFonts(): void {
  configureTauriFontCache()
  if (isTauri()) {
    void getTauriFonts().then(registerFontFaces)
    return
  }
  if (googleFontsEnabled.value) fontManager.preloadGoogleFamilies()
}

export function localFontAccessState(): LocalFontAccessState {
  return isTauri() ? 'granted' : fontManager.localAccessState()
}

export async function requestLocalFontAccess(): Promise<FontFamilyOption[]> {
  if (isTauri()) return listFamilies()
  await fontManager.requestLocalFontAccess()
  return listFamilies()
}

export async function downloadedFontCacheSummary() {
  configureTauriFontCache()
  if (!isTauri()) return { count: 0, byteLength: 0, updatedAt: null }
  return tauriDownloadedFontCacheSummary()
}

export async function clearDownloadedFontCache(): Promise<void> {
  configureTauriFontCache()
  if (!isTauri()) return
  await clearTauriDownloadedFontCache()
}

export async function predownloadFallbackFonts() {
  return fontManager.ensureFallbackPack()
}

function registerFontFaces(fonts: TauriFontFamily[]): void {
  if (typeof document === 'undefined') return
  for (const { family } of fonts) {
    const face = new FontFace(family, `local("${family}")`)
    document.fonts.add(face)
  }
}

export async function listFamilies(): Promise<FontFamilyOption[]> {
  configureTauriFontCache()
  if (isTauri()) {
    const fonts = await getTauriFonts()
    return fonts.map((f) => ({ family: f.family, source: 'local' }))
  }
  const fonts = await fontManager.listFamilyOptions()
  return googleFontsEnabled.value ? fonts : fonts.filter((font) => font.source !== 'google')
}

export async function listFonts(): Promise<TauriFontFamily[]> {
  configureTauriFontCache()
  if (isTauri()) {
    return getTauriFonts()
  }
  return []
}

export async function ensureGraphFonts(graph: SceneGraph, nodeIds: string[]): Promise<boolean> {
  const fontKeys = fontManager.collectFontKeys(graph, nodeIds)
  const missing = fontKeys.filter(([family, style]) => !fontManager.isStyleLoaded(family, style))
  const needsFallback = graphFallbackNeeds(graph, nodeIds)
  if (missing.length === 0 && !needsFallback.cjk && !needsFallback.arabic) return false

  const results = await Promise.all(missing.map(([family, style]) => loadFont(family, style)))
  const [cjkFallbacks, arabicFallbacks] = await Promise.all([
    needsFallback.cjk ? fontManager.ensureCJKFallback() : Promise.resolve([]),
    needsFallback.arabic ? fontManager.ensureArabicFallback() : Promise.resolve([])
  ])
  const loaded =
    results.some((result) => result !== null) ||
    cjkFallbacks.length > 0 ||
    arabicFallbacks.length > 0
  if (loaded) clearTextPictures(graph)
  return loaded
}

function graphFallbackNeeds(
  graph: SceneGraph,
  nodeIds: string[]
): { cjk: boolean; arabic: boolean } {
  const texts: string[] = []

  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    if (node.type === 'TEXT') {
      texts.push(node.text)
    }
    for (const childId of node.childIds) visit(childId)
  }

  for (const id of nodeIds) visit(id)
  const hasCJK = texts.some((text) => CJK_TEXT_RE.test(text))
  const hasArabic = texts.some((text) => ARABIC_TEXT_RE.test(text))
  return {
    cjk: hasCJK && fontManager.getCJKFallbackFamilies().length === 0,
    arabic: hasArabic && fontManager.getArabicFallbackFamilies().length === 0
  }
}

function clearTextPictures(graph: SceneGraph): void {
  for (const [, node] of graph.nodes) {
    if (node.type === 'TEXT') node.textPicture = null
  }
}

export async function loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  configureTauriFontCache()
  if (isTauri()) {
    const cached = await fontManager.loadCachedFont(family, style)
    if (cached) return cached

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const data = await invoke<number[]>('load_system_font', { family, style })
      const buffer = new Uint8Array(data).buffer

      fontManager.markLoaded(family, style, buffer)

      const weight = styleToWeight(style)
      const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
      const face = new FontFace(family, buffer, { weight: String(weight), style: italic })
      await face.load()
      document.fonts.add(face)

      return buffer
    } catch {
      return fontManager.loadFont(family, style)
    }
  }

  return fontManager.loadFont(family, style)
}
