import { fontManager, styleToWeight, type LocalFontAccessState } from '@open-pencil/core/text'

import {
  clearDownloadedFontCache as clearTauriDownloadedFontCache,
  createTauriDownloadedFontCache,
  downloadedFontCacheSummary as tauriDownloadedFontCacheSummary
} from '@/app/editor/fonts/cache'
import { isTauri } from '@/app/tauri/env'

if (typeof navigator !== 'undefined') {
  fontManager.setFallbackUserAgent(navigator.userAgent)
}

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
  }
}

export function localFontAccessState(): LocalFontAccessState {
  return isTauri() ? 'granted' : fontManager.localAccessState()
}

export async function requestLocalFontAccess(): Promise<string[]> {
  if (isTauri()) return listFamilies()
  await fontManager.requestLocalFontAccess()
  return fontManager.listFamilies()
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

export async function listFamilies(): Promise<string[]> {
  configureTauriFontCache()
  if (isTauri()) {
    const fonts = await getTauriFonts()
    return fonts.map((f) => f.family)
  }
  return fontManager.listFamilies()
}

export async function listFonts(): Promise<TauriFontFamily[]> {
  configureTauriFontCache()
  if (isTauri()) {
    return getTauriFonts()
  }
  return []
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
