import { invoke } from '@tauri-apps/api/core'
import { platform } from '@tauri-apps/plugin-os'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import {
  createIconProvider,
  createSFSymbolsProvider,
  SF_SYMBOLS_PREFIX
} from '@open-pencil/core/icons'
import { createIconMatcher, fetchIconIndex, type IconMatcher } from '@open-pencil/core/icons/match'
import { createCanvasKitRasterCodec, renderNodesToImage } from '@open-pencil/core/io/formats/raster'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
import { withAbortSignal } from '@/app/runtime/abort'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/**
 * SF Symbols, drawn by the desktop app on a Mac that can draw them. Elsewhere the set is still
 * listed, as unavailable, so the icon picker can say where it is offered.
 */
const sfSymbols = createSFSymbolsProvider(
  IS_TAURI && platform() === 'macos'
    ? {
        catalogue: () => invoke<string | null>('sf_symbols_catalogue'),
        render: (request) => invoke<string | null>('sf_symbols_render', { request })
      }
    : null
)

/** How the app reaches icon sets' files on a CDN, as it reaches web fonts. */
const iconSetFetch = IS_TAURI ? tauriFetch : browserWebFontFetch

/**
 * The app's icons: Iconify's, with Material Symbols drawn from Google's fonts, reached as the app's
 * web fonts are, and SF Symbols.
 */
export const appIcons = createIconProvider(iconSetFetch, [
  { prefixes: [SF_SYMBOLS_PREFIX], provider: sfSymbols }
])

let loadedIndex: ReturnType<typeof fetchIconIndex> | undefined

/** whaticon's index, downloaded once for every import; a failed download is tried again. */
function iconIndex(): ReturnType<typeof fetchIconIndex> {
  loadedIndex ??= fetchIconIndex(iconSetFetch).catch((error: unknown) => {
    loadedIndex = undefined
    throw error
  })
  return loadedIndex
}

/**
 * Names the icons one imported HTML page draws, drawn with the editor's renderer as library
 * thumbnails are. Each import gets its own matcher, so what it compared goes with it; the index
 * is shared. When `signal` aborts, as a newer import supersedes this one, the import stops
 * waiting for its icons.
 */
export function appIconMatcher(renderer: SkiaRenderer, signal: AbortSignal): IconMatcher {
  const codec = createCanvasKitRasterCodec(renderer.ck)
  const matcher = createIconMatcher({
    index: iconIndex,
    icons: appIcons,
    draw: async (graph, pageId, nodeId, scale) => {
      const png = renderNodesToImage(renderer.ck, renderer, graph, pageId, [nodeId], {
        scale,
        format: 'PNG'
      })
      return png && codec.decode(png)
    }
  })
  return (svgs) => withAbortSignal(matcher(svgs), signal)
}
