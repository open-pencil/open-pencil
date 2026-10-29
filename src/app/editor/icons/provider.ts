import {
  createIconProvider,
  createSFSymbolsProvider,
  SF_SYMBOLS_PREFIX
} from '@open-pencil/core/icons'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

async function invoke(command: string, args?: Record<string, unknown>): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string | null>(command, args)
}

/** SF Symbols, drawn by the desktop app, which offers them only on a Mac that can draw them. */
const sfSymbols = createSFSymbolsProvider({
  catalogue: () => invoke('sf_symbols_catalogue'),
  render: (request) => invoke('sf_symbols_render', { request })
})

/**
 * The app's icons: Iconify's, with Material Symbols drawn from Google's fonts, reached as the app's
 * web fonts are, and SF Symbols on the desktop.
 */
export const appIcons = IS_TAURI
  ? createIconProvider(tauriFetch, [{ prefixes: [SF_SYMBOLS_PREFIX], provider: sfSymbols }])
  : createIconProvider(browserWebFontFetch)
