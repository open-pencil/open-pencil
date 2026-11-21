import { compact } from 'es-toolkit'
import { limitAsync } from 'es-toolkit/promise'

import { parseCSSColor, parseCSSURLs } from '@open-pencil/scene-graph/css'
import { appendAll } from '@open-pencil/std/arrays'
import { DEADLINE_MS } from '@open-pencil/std/timing'

import {
  parseFontFaceRules,
  parseStylesheetImports,
  type CSSFontFaceRule
} from '../import/font-faces'
import type { DesignElement, DesignResource, DesignResourceFetch } from '../types'

/**
 * How long a page's picture, stylesheet, or font file may take to arrive when read back for the
 * document, before the import goes on without it: a request that never ends must not hold an
 * import forever.
 */
export const RESOURCE_TIMEOUT_MS = DEADLINE_MS.request

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
 * How many pictures are read at once: enough to keep a page's requests flowing, few enough that
 * the bytes in flight stay within what a page's budget counts as each read completes.
 */
const IMAGE_READS_IN_FLIGHT = 6

/**
 * Reads the pictures elements show with `fetch` and puts them on the elements: an `<img>`'s from
 * the address it loaded, and each `background-image` layer's from its computed `url()`. Each
 * address is read once, a few at a time, and one that cannot be read is left out.
 */
export async function attachImages(
  images: readonly [DesignElement, string][],
  fetch: DesignResourceFetch | undefined,
  backgrounds: readonly DesignElement[] = []
): Promise<void> {
  if (!fetch) return
  const pictures = new Map<string, Promise<DesignResource | null>>()
  // Each read's deadline starts when it does, not while it waits its turn.
  const read = limitAsync(
    (url: string) => fetch(url, AbortSignal.timeout(RESOURCE_TIMEOUT_MS)).catch(() => null),
    IMAGE_READS_IN_FLIGHT
  )
  const picture = (url: string) => {
    let reading = pictures.get(url)
    if (!reading) {
      reading = read(url)
      pictures.set(url, reading)
    }
    return reading
  }
  await Promise.all([
    ...images.map(async ([element, url]) => {
      const resource = await picture(url)
      if (resource) element.image = resource
    }),
    ...backgrounds.map(async (element) => {
      // Kept under the address the style names, which the importer looks each layer's picture up
      // by, even when the read was redirected elsewhere.
      const read = await Promise.all(
        backgroundImageURLs(element).map(async (url) => {
          const resource = await picture(url)
          return resource && { ...resource, url }
        })
      )
      const resources = compact(read)
      if (resources.length > 0) element.backgroundImages = resources
    })
  ])
}

/** The addresses an element's computed `background-image` layers name, as computed, absolute. */
export function backgroundImageURLs(element: DesignElement): string[] {
  return parseCSSURLs(element.computedStyle?.['background-image']).filter((url) =>
    URL.canParse(url)
  )
}
