export { initFontService, getFontProvider, ensureNodeFont } from '@open-pencil/core'

import { loadFont as loadFontCore, getFontProvider } from '@open-pencil/core'

interface TauriFontFamily {
  family: string
  styles: string[]
}

let tauriFontsCache: TauriFontFamily[] | null = null

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

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
  if (isTauri()) {
    getTauriFonts().then(registerFontFaces)
  }
}

function registerFontFaces(fonts: TauriFontFamily[]): void {
  if (typeof document === 'undefined') return
  for (const { family } of fonts) {
    const face = new FontFace(family, `local("${family}")`)
    document.fonts.add(face)
  }
}

export async function listFamilies(): Promise<string[]> {
  if (isTauri()) {
    const fonts = await getTauriFonts()
    return fonts.map((f) => f.family)
  }

  const { listFamilies: coreList } = await import('@open-pencil/core')
  return coreList()
}

export async function loadFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const data = await invoke<number[]>('load_system_font', { family, style })
      const buffer = new Uint8Array(data).buffer

      const provider = getFontProvider()
      if (provider) provider.registerFont(buffer, family)

      const weight = styleToWeight(style)
      const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
      const face = new FontFace(family, buffer, { weight: String(weight), style: italic })
      await face.load()
      document.fonts.add(face)

      return buffer
    } catch {
      return loadFontCore(family, style)
    }
  }

  return loadFontCore(family, style)
}

function styleToWeight(style: string): number {
  const s = style.toLowerCase()
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
