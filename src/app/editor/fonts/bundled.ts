import harfBuzzSubset from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url'

import caveatVariable from '@open-pencil/core/assets/CaveatVariable.woff2?url'
import interSemiBold from '@open-pencil/core/assets/Inter-SemiBold.ttf?url'
import interVariableItalic from '@open-pencil/core/assets/InterVariable-Italic.ttf?url'
import interVariable from '@open-pencil/core/assets/InterVariable.ttf?url'
import notoNaskhArabic from '@open-pencil/core/assets/NotoNaskhArabic-Regular.ttf?url'
import emojiMetrics from '@open-pencil/core/assets/OpenPencilEmojiMetrics-Regular.ttf?url'
import { fontManager, setHarfBuzzSubsetLocator } from '@open-pencil/core/text'

/**
 * Core ships its bundled fonts in `@open-pencil/core/assets`. Importing them as assets lets
 * Vite serve them in development and emit hashed copies with the build, so no host keeps a
 * second copy in `public/`. Kept apart from `index.ts` because `?url` imports only resolve
 * in a Vite build, not in the Bun test runner.
 */
const BUNDLED_FONT_URLS: Record<string, string> = {
  'InterVariable.ttf': interVariable,
  'InterVariable-Italic.ttf': interVariableItalic,
  'Inter-SemiBold.ttf': interSemiBold,
  'NotoNaskhArabic-Regular.ttf': notoNaskhArabic,
  'OpenPencilEmojiMetrics-Regular.ttf': emojiMetrics,
  'CaveatVariable.woff2': caveatVariable
}

/**
 * Points core at the emitted font files, and at HarfBuzz's subsetter, which cuts static files of
 * variable font instances for PDF export. Call before any font loads.
 */
export function installBundledFonts(): void {
  fontManager.setBundledFontLocator((file) => BUNDLED_FONT_URLS[file] ?? `/${file}`)
  setHarfBuzzSubsetLocator(() => harfBuzzSubset)
}
