import { invoke } from '@tauri-apps/api/core'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import {
  createIconProvider,
  createSFSymbolsProvider,
  SF_SYMBOLS_PREFIX
} from '@open-pencil/core/icons'
import { createIconMatcher, fetchIconIndex, type IconMatcher } from '@open-pencil/core/icons/match'
import { createCanvasKitRasterCodec, renderNodesToImage } from '@open-pencil/core/io/formats/raster'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/** SF Symbols, drawn by the desktop app, which offers them only on a Mac that can draw them. */
const sfSymbols = createSFSymbolsProvider({
  catalogue: () => invoke<string | null>('sf_symbols_catalogue'),
  render: (request) => invoke<string | null>('sf_symbols_render', { request })
})

/**
 * The app's icons: Iconify's, with Material Symbols drawn from Google's fonts, reached as the app's
 * web fonts are, and SF Symbols on the desktop.
 */
export const appIcons = IS_TAURI
  ? createIconProvider(tauriFetch, [{ prefixes: [SF_SYMBOLS_PREFIX], provider: sfSymbols }])
  : createIconProvider(browserWebFontFetch)

/** How the app reaches icon sets' files on a CDN, as it reaches web fonts. */
const iconSetFetch = IS_TAURI ? tauriFetch : browserWebFontFetch

const matchers = new WeakMap<SkiaRenderer, IconMatcher>()

/**
 * Names the icons imported HTML draws, drawn with the editor's renderer as library thumbnails are.
 * One matcher per renderer keeps the index and what it compared across imports.
 */
export function appIconMatcher(renderer: SkiaRenderer): IconMatcher {
  const known = matchers.get(renderer)
  if (known) return known
  const codec = createCanvasKitRasterCodec(renderer.ck)
  const matcher = createIconMatcher({
    index: () => fetchIconIndex(iconSetFetch),
    icons: appIcons,
    draw: async (graph, pageId, nodeId, scale) => {
      const png = renderNodesToImage(renderer.ck, renderer, graph, pageId, [nodeId], {
        scale,
        format: 'PNG'
      })
      return png && codec.decode(png)
    }
  })
  matchers.set(renderer, matcher)
  return matcher
}
