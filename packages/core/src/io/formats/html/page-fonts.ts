import { fileTypeFromBuffer } from 'file-type'

import type { DesignDocument, DesignResourceFetch } from '@open-pencil/dom-css'
import { cssFontFamilyName, parseCSSFontFamilies } from '@open-pencil/scene-graph/css'

import { fontManager } from '#core/text/font/manager'
import { faceStyleName } from '#core/text/font/names'
import { sfntFont } from '#core/text/font/woff2'

import { designElements } from './elements'
import type { PageFontFamilies } from './fonts'

/** How long one font file may take to arrive before the import goes on without it. */
const FONT_LOAD_TIMEOUT_MS = 10_000

/** Font formats the font manager reads, by the media type their bytes say they are. */
const READABLE_FONT_TYPES = new Set(['font/ttf', 'font/otf', 'font/woff2'])

/** The families a styled page's text asks for, by their lowercase names. */
function familiesUsed(styled: DesignDocument): Set<string> {
  const used = new Set<string>()
  for (const element of designElements(styled.children)) {
    const list = element.computedStyle?.['font-family']
    for (const family of list ? parseCSSFontFamilies(list) : []) {
      used.add(cssFontFamilyName(family).toLowerCase())
    }
  }
  return used
}

/** A font file as TrueType or OpenType, WOFF2 decompressed; null for a format it cannot read. */
async function readableFont(bytes: Uint8Array): Promise<ArrayBuffer | null> {
  const type = (await fileTypeFromBuffer(bytes))?.mime
  if (!type || !READABLE_FONT_TYPES.has(type)) return null
  return sfntFont(bytes.slice().buffer)
}

/**
 * Loads the faces a page's `@font-face` rules declare for the families its text uses, with
 * `fetch`, and registers them with the font manager under the family and face each rule names, so
 * the page's text is set in its own fonts, icon fonts among them. A family the editor already has,
 * bundled, installed, or from Google Fonts, keeps the editor's complete copy rather than a page's
 * subset of it, which would leave its other glyphs and faces out. A rule's sources are tried in
 * order until one is in a format the font manager reads. Returns the families the page's text can
 * be set in.
 */
export async function loadPageFontFaces(
  styled: DesignDocument,
  fetch: DesignResourceFetch
): Promise<PageFontFamilies> {
  const used = familiesUsed(styled)
  const loaded = new Map<string, string>()
  const rules = (styled.fontFaces ?? []).filter((rule) => used.has(rule.family.toLowerCase()))
  // Which faces the editor has is settled before any of the page's are registered, so a page
  // that splits a face into subsets by unicode-range loads every subset, not just the first.
  const editorHas = await Promise.all(
    rules.map((rule) =>
      fontManager.loadFont(rule.family, faceStyleName(rule.family, rule.weight, rule.italic))
    )
  )
  for (const [index, rule] of rules.entries()) {
    const style = faceStyleName(rule.family, rule.weight, rule.italic)
    if (editorHas[index]) {
      loaded.set(rule.family.toLowerCase(), rule.family)
      continue
    }
    for (const source of rule.sources) {
      const resource = await fetch(source, AbortSignal.timeout(FONT_LOAD_TIMEOUT_MS)).catch(
        () => null
      )
      // A source that does not decode is passed over for the next, as an unreadable one is.
      const data = resource ? await readableFont(resource.bytes).catch(() => null) : null
      if (!data) continue
      await fontManager.markLoaded(rule.family, style, data)
      loaded.set(rule.family.toLowerCase(), rule.family)
      break
    }
  }
  return loaded
}
