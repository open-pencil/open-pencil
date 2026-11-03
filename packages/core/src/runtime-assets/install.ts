import caveatVariable from '#core-assets/CaveatVariable.woff2?url'
import interSemiBold from '#core-assets/Inter-SemiBold.ttf?url'
import interVariableItalic from '#core-assets/InterVariable-Italic.ttf?url'
import interVariable from '#core-assets/InterVariable.ttf?url'
import notoNaskhArabic from '#core-assets/NotoNaskhArabic-Regular.ttf?url'
import emojiMetrics from '#core-assets/OpenPencilEmojiMetrics-Regular.ttf?url'
/**
 * Points Core at the files it loads at run time, imported as Vite `?url` assets so a Vite build
 * serves them in development and emits them, hashed and under `base`, with the build. Importing
 * the module is the whole setup; the `openPencil()` plugin adds it to the page, and an app that
 * loads Core behind a gate of its own imports it there instead. Its `?url` imports stay as written in
 * `dist`, so the app's Vite resolves them, the fonts through Core's `#core-assets` import.
 */
import canvasKit from 'canvaskit-wasm/bin/full/canvaskit.wasm?url'
import harfBuzzSubset from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url'

import { setCanvasKitLocator } from '#core/canvaskit'
import { setHarfBuzzSubsetLocator } from '#core/text/font/harfbuzz'
import { fontManager } from '#core/text/font/manager'

/** Every font file in `@open-pencil/core/assets`: the bundled faces and the stand-ins. */
const FONT_URLS: Record<string, string> = {
  'CaveatVariable.woff2': caveatVariable,
  'Inter-SemiBold.ttf': interSemiBold,
  'InterVariable-Italic.ttf': interVariableItalic,
  'InterVariable.ttf': interVariable,
  'NotoNaskhArabic-Regular.ttf': notoNaskhArabic,
  'OpenPencilEmojiMetrics-Regular.ttf': emojiMetrics
}

setCanvasKitLocator(() => canvasKit)
setHarfBuzzSubsetLocator(() => harfBuzzSubset)
fontManager.setBundledFontLocator((file) => FONT_URLS[file] ?? `/${file}`)
