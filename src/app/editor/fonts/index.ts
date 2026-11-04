import { invoke } from '@tauri-apps/api/core'
import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'

import {
  DEFAULT_WEB_FONT_PROVIDER_SETTINGS,
  WEB_FONT_PROVIDER_IDS,
  fontManager,
  prepareGraphFonts,
  type FontFamilyOption,
  type HostFontFamily,
  type LocalFontAccessState,
  type WebFontProviderId,
  UnsupportedFontFormatError
} from '@open-pencil/core/text'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
import {
  clearDownloadedFontCache as clearTauriDownloadedFontCache,
  createTauriDownloadedFontCache,
  downloadedFontCacheSummary as tauriDownloadedFontCacheSummary
} from '@/app/editor/fonts/cache'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

if (typeof navigator !== 'undefined') {
  fontManager.setFallbackUserAgent(navigator.userAgent)
}

export type FontProviderSettings = Record<WebFontProviderId, boolean>

/** Online fonts are on until turned off in Settings. */
export const DEFAULT_ONLINE_FONTS = true
export const onlineFontsEnabled = useLocalStorage('op-online-fonts-enabled', DEFAULT_ONLINE_FONTS)
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
              fontProviderSettings.value[provider] && (isTauri() || provider !== 'google')
            ])
          )
        : {}
    )
  },
  { deep: true, immediate: true }
)

let tauriFontCacheConfigured = false

function configureTauriFontCache() {
  if (tauriFontCacheConfigured || !isTauri()) return
  tauriFontCacheConfigured = true
  fontManager.setDownloadedFontCache(createTauriDownloadedFontCache())
  fontManager.setWebFontFetch(tauriFetch)
  fontManager.setHostFontLoader(loadSystemFont)
}

configureTauriFontCache()
if (!isTauri()) fontManager.setWebFontFetch(browserWebFontFetch)

let tauriFontsCache: HostFontFamily[] | null = null
let tauriFontsPromise: Promise<HostFontFamily[]> | null = null

async function getTauriFonts(): Promise<HostFontFamily[]> {
  if (tauriFontsCache) return tauriFontsCache
  if (!tauriFontsPromise) {
    tauriFontsPromise = invoke<HostFontFamily[]>('list_system_fonts')
      .then((fonts) => {
        tauriFontsCache = fonts
        // The weight list and family switches read each family's faces from these.
        fontManager.setHostFontCatalog(fonts)
        return fonts
      })
      .catch(() => [])
  }
  return tauriFontsPromise
}

export function preloadFonts(): void {
  configureTauriFontCache()
  // The installed families are listed ahead for the font picker. The page draws them by name
  // already; a face registered under a family's name would stand in for all of its faces.
  if (isTauri()) {
    void getTauriFonts()
    return
  }
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
  return fontManager.listFamilyOptions()
}

export async function listFonts(): Promise<HostFontFamily[]> {
  configureTauriFontCache()
  if (isTauri()) {
    return getTauriFonts()
  }
  return []
}

interface FontRenderInvalidator {
  invalidateNodesForFonts(graph: SceneGraph, nodeIds: readonly string[]): void
}

/**
 * Prepares the fonts of `nodeIds` with the app's loader, keeping them off the canvas meanwhile;
 * resolves to whether that changed any face their text draws with.
 */
export async function ensureGraphFonts(
  graph: SceneGraph,
  nodeIds: string[],
  renderer?: FontRenderInvalidator | null
): Promise<boolean> {
  try {
    const prepared = await prepareGraphFonts(graph, nodeIds, {
      loadFont,
      hide: true,
      treatUnknownCoverageAsMissing: IS_TAURI
    })
    return prepared.changed
  } finally {
    renderer?.invalidateNodesForFonts(graph, nodeIds)
  }
}

type NativeFontLoadError = { code?: 'not-found' | 'unsupported-format' | 'failed' }

async function loadSystemFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
  if (!isTauri()) return null
  try {
    const data = await invoke<ArrayBuffer>('load_system_font', { family, style })
    if (data.byteLength === 0) return null
    return data
  } catch (error) {
    if ((error as NativeFontLoadError | null)?.code === 'unsupported-format') {
      throw new UnsupportedFontFormatError(family, style)
    }
    return null
  }
}

export async function loadFont(
  family: string,
  style = 'Regular',
  characters = '',
  signal?: AbortSignal
): Promise<ArrayBuffer | null> {
  configureTauriFontCache()
  return fontManager.loadFont(family, style, characters, signal)
}
