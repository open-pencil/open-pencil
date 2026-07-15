import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'

import {
  DEFAULT_WEB_FONT_PROVIDER_SETTINGS,
  WEB_FONT_PROVIDER_IDS,
  fontManager,
  styleToWeight,
  textNeededFallbackScripts,
  type FontFamilyOption,
  type LocalFontAccessState,
  type WebFontProviderId
} from '@open-pencil/core/text'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { dialogMessages } from '@open-pencil/vue'

import {
  clearDownloadedFontCache as clearTauriDownloadedFontCache,
  createTauriDownloadedFontCache,
  downloadedFontCacheSummary as tauriDownloadedFontCacheSummary
} from '@/app/editor/fonts/cache'
import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

if (typeof navigator !== 'undefined') {
  fontManager.setFallbackUserAgent(navigator.userAgent)
}

export type FontProviderSettings = Record<WebFontProviderId, boolean>

export const onlineFontsEnabled = useLocalStorage('op-online-fonts-enabled', true)
export const fontProviderSettings = useLocalStorage<FontProviderSettings>(
  'op-font-providers',
  DEFAULT_WEB_FONT_PROVIDER_SETTINGS
)

watch(
  [onlineFontsEnabled, fontProviderSettings],
  () => {
    fontManager.setOnlineFontProviders(
      onlineFontsEnabled.value
        ? Object.fromEntries(
            WEB_FONT_PROVIDER_IDS.map((provider) => [
              provider,
              fontProviderSettings.value[provider]
            ])
          )
        : {}
    )
  },
  { deep: true, immediate: true }
)

let tauriFontCacheConfigured = false
let webFontUnavailableToastShown = false

function showWebFontUnavailableToast(): void {
  if (webFontUnavailableToastShown || isTauri() || !onlineFontsEnabled.value) return
  if (!WEB_FONT_PROVIDER_IDS.some((provider) => fontProviderSettings.value[provider])) return
  webFontUnavailableToastShown = true
  toast.warning(dialogMessages.get().webFontProvidersRequireDesktopApp)
}

function configureTauriFontCache() {
  if (tauriFontCacheConfigured || !isTauri()) return
  tauriFontCacheConfigured = true
  fontManager.setDownloadedFontCache(createTauriDownloadedFontCache())
  fontManager.setWebFontFetch(tauriFetch)
  fontManager.setHostFallbackFontLoader(loadFont)
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
    return
  }
  requestLocalFontAccess()
  if (onlineFontsEnabled.value) fontManager.preloadWebFontFamilies()
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
    const [systemFonts, webFonts] = await Promise.all([
      getTauriFonts(),
      fontManager.listFamilyOptions()
    ])
    const byFamily = new Map(webFonts.map((font) => [font.family, font]))
    for (const font of systemFonts)
      byFamily.set(font.family, { family: font.family, source: 'local' })
    return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family))
  }
  showWebFontUnavailableToast()
  return fontManager.listFamilyOptions()
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
  const results = await Promise.all(missing.map(([family, style]) => loadFont(family, style)))
  const loaded = results.some((result) => result !== null)
  const fallbackScripts = neededFallbackScriptsForNodes(graph, nodeIds)
  if (fallbackScripts.length > 0) {
    const fallbacks = await fontManager.ensureFallbackPack(fallbackScripts)
    if (Object.values(fallbacks).some((families) => families.length > 0)) clearTextPictures(graph)
  } else if (loaded) {
    clearTextPictures(graph)
  }
  return loaded || fallbackScripts.length > 0
}

function neededFallbackScriptsForNodes(graph: SceneGraph, nodeIds: string[]) {
  const scripts = new Set<ReturnType<typeof textNeededFallbackScripts>[number]>()
  const collect = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    if (node.type === 'TEXT') {
      for (const script of textNeededFallbackScripts(node)) scripts.add(script)
    }
    for (const childId of node.childIds) collect(childId)
  }
  for (const id of nodeIds) collect(id)
  return [...scripts]
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

  const loaded = await fontManager.loadFont(family, style)
  if (!loaded) showWebFontUnavailableToast()
  return loaded
}
