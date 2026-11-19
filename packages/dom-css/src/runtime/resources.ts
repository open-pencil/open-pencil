import { appendAll } from '@open-pencil/scene-graph/arrays'
import { parseCSSColor } from '@open-pencil/scene-graph/css'

import {
  parseFontFaceRules,
  parseStylesheetImports,
  type CSSFontFaceRule
} from '../import/font-faces'
import type { DesignElement, DesignResource, DesignResourceFetch } from '../types'

/**
 * How long a page's picture or stylesheet may take to arrive, or an image to load in the sandbox,
 * before styling goes on without it. An image without a size takes its own once loaded, moving
 * what follows it, but a request that never ends must not hold an import forever.
 */
export const RESOURCE_TIMEOUT_MS = 10_000

/**
 * The color a document's canvas is painted, as CSS takes it: the root element's background, or
 * the body's when the root has none.
 */
export function canvasBackground(document: Document): string | undefined {
  const view = document.defaultView
  if (!view) return undefined
  const root = view.getComputedStyle(document.documentElement).backgroundColor
  if (parseCSSColor(root)) return root
  const body = view.getComputedStyle(document.body).backgroundColor
  return parseCSSColor(body) ? body : undefined
}

/** The most stylesheets read for a page's `@font-face` rules, through linked sheets and `@import`. */
const MAX_FONT_STYLESHEETS = 32

/**
 * The `@font-face` rules of a page's CSS and every stylesheet it imports, read with `fetch`: the
 * sandbox loaded those sheets, but one from another site cannot be read back from it.
 */
export async function fontFaceRules(
  cssText: string,
  baseURL: string | undefined,
  fetch: DesignResourceFetch
): Promise<CSSFontFaceRule[]> {
  const rules = parseFontFaceRules(cssText, baseURL)
  const queue = parseStylesheetImports(cssText, baseURL)
  const read = new Set<string>()
  while (queue.length > 0 && read.size < MAX_FONT_STYLESHEETS) {
    const url = queue.shift()
    if (url === undefined || read.has(url)) continue
    read.add(url)
    const sheet = await fetch(url, AbortSignal.timeout(RESOURCE_TIMEOUT_MS)).catch(() => null)
    if (!sheet) continue
    const css = new TextDecoder().decode(sheet.bytes)
    appendAll(rules, parseFontFaceRules(css, sheet.url))
    appendAll(queue, parseStylesheetImports(css, sheet.url))
  }
  return rules
}

/**
 * Reads each image's picture with `fetch` and puts it on its element, each address once. One that
 * cannot be read leaves its element as it was.
 */
export async function attachImages(
  images: readonly [DesignElement, string][],
  fetch: DesignResourceFetch | undefined
): Promise<void> {
  if (!fetch) return
  const pictures = new Map<string, Promise<DesignResource | null>>()
  await Promise.all(
    images.map(async ([element, url]) => {
      let picture = pictures.get(url)
      if (!picture) {
        picture = fetch(url, AbortSignal.timeout(RESOURCE_TIMEOUT_MS)).catch(() => null)
        pictures.set(url, picture)
      }
      const resource = await picture
      if (resource) element.image = resource
    })
  )
}
