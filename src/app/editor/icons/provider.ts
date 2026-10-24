import { createIconProvider } from '@open-pencil/core/icons'

import { browserWebFontFetch } from '@/app/editor/fonts/browser-fetch'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/** The app's icons: Iconify's, with Material Symbols drawn from Google's fonts, reached as the app's web fonts are. */
export const appIcons = createIconProvider(IS_TAURI ? tauriFetch : browserWebFontFetch)
