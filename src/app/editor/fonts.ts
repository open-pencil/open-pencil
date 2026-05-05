import { IS_TAURI } from '@open-pencil/core/constants'
import { fontManager, styleToWeight, type LocalFontAccessState } from '@open-pencil/core/text'

import { createTauriDownloadedFontCache } from '@/app/editor/font-cache'

if (typeof navigator !== 'undefined') {
  fontManager.setFallbackUserAgent(navigator.userAgent)
}

if (IS_TAURI) {
  fontManager.setDownloadedFontCache(createTauriDownloadedFontCache())
}

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
  if (IS_TAURI) {
    void getTauriFonts().then(registerFontFaces)
  }
}

export function localFontAccessState(): LocalFontAccessState {
  return IS_TAURI ? 'granted' : fontManager.localAccessState()
}

export async function requestLocalFontAccess(): Promise<string[]> {
  if (IS_TAURI) return listFamilies()
  await fontManager.requestLocalFontAccess()
  return fontManager.listFamilies()
}

function registerFontFaces(fonts: TauriFontFamily[]): void {
  if (typeof document === 'undefined') return
  for (const { family } of fonts) {
    const face = new FontFace(family, `local("${family}")`)
    document.fonts.add(face)
  }
}

export async function listFamilies(): Promise<string[]> {
  if (IS_TAURI) {
    const fonts = await getTauriFonts()
    return fonts.map((f) => f.family)
  }
  return fontManager.listFamilies()
}

export async function listFonts(): Promise<TauriFontFamily[]> {
  if (IS_TAURI) {
    return getTauriFonts()
  }
  return []
}

export async function loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  if (IS_TAURI) {
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
