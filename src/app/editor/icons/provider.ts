import { invoke } from '@tauri-apps/api/core'
import { platform } from '@tauri-apps/plugin-os'

import {
  createIconProvider,
  createSFSymbolsProvider,
  SF_SYMBOLS_PREFIX
} from '@open-pencil/core/icons'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
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

/**
 * The app's icons: Iconify's, with Material Symbols drawn from Google's fonts, reached as the app's
 * web fonts are, and SF Symbols.
 */
export const appIcons = createIconProvider(IS_TAURI ? tauriFetch : browserWebFontFetch, [
  { prefixes: [SF_SYMBOLS_PREFIX], provider: sfSymbols }
])
