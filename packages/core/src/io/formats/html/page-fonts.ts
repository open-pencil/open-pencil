import { fileTypeFromBuffer } from 'file-type'

import type { CSSFontFaceRule, DesignDocument, DesignResourceFetch } from '@open-pencil/dom-css'
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

/** Whether a rule loads its font from a provider the editor fetches that family from itself. */
async function servedByProvider(rule: CSSFontFaceRule): Promise<boolean> {
  for (const source of rule.sources) {
    if (await fontManager.servesFontFile(rule.family, source).catch(() => false)) return true
  }
  return false
}

/**
 * Loads the faces a page's `@font-face` rules declare for the families its text uses, with
 * `fetch`, and registers them with the font manager under the family and face each rule names, so
 * the page's text is set in its own fonts, as the browser sets it, icon fonts among them. A face the
 * page loads from a provider the editor fetches fonts from, such as Google Fonts, is the editor's
 * own copy of it, whole rather than the page's subsets. A face the page serves itself is the page's
 * file, even where the editor has a family of that name, which may be another design; a face split
 * into files by `unicode-range` draws from all of them. A rule's sources are tried in order until
 * one is in a format the font manager reads. Returns the families the page's text can be set in;
 * once `signal` aborts, it stops and rejects without registering another face.
 */
export async function loadPageFontFaces(
  styled: DesignDocument,
  fetch: DesignResourceFetch,
  signal?: AbortSignal
): Promise<PageFontFamilies> {
  const used = familiesUsed(styled)
  const loaded = new Map<string, string>()
  const rules = (styled.fontFaces ?? []).filter((rule) => used.has(rule.family.toLowerCase()))
  // The faces this page registered a file for, which its later subsets join.
  const registered = new Set<string>()
  for (const rule of rules) {
    const style = faceStyleName(rule.family, rule.weight, rule.italic)
    const face = `${rule.family.toLowerCase()}|${style}`
    if (
      !registered.has(face) &&
      (await servedByProvider(rule)) &&
      (await fontManager.loadFont(rule.family, style))
    ) {
      loaded.set(rule.family.toLowerCase(), rule.family)
      continue
    }
    for (const source of rule.sources) {
      signal?.throwIfAborted()
      const resource = await fetch(source, AbortSignal.timeout(FONT_LOAD_TIMEOUT_MS)).catch(
        () => null
      )
      // A source that does not decode is passed over for the next, as an unreadable one is.
      const data = resource ? await readableFont(resource.bytes).catch(() => null) : null
      if (!data) continue
      // An import cancelled meanwhile registers nothing more: the font manager is shared, and a
      // face it took now could replace one a later import loaded.
      signal?.throwIfAborted()
      // The first file of a face is its own; the face's later files, its subsets, join it. A
      // variable file draws the family's other weights through the manager as any variable face
      // does, unless the page names their files too.
      if (registered.has(face)) await fontManager.addFaceShard(rule.family, style, data)
      else await fontManager.markLoaded(rule.family, style, data)
      registered.add(face)
      loaded.set(rule.family.toLowerCase(), rule.family)
      break
    }
  }
  return loaded
}
