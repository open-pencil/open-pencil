import { compact } from 'es-toolkit'
import valueParser, { type Node } from 'postcss-value-parser'
import { decode, parsePath } from 'ufo'

import { tryParseColor } from '../color'
import type { Color } from '../primitives'
import type { ColorProfile } from '../types'

/** A CSS dimension's number and lowercase unit, or null. */
export function dimension(value: string): { number: number; unit: string } | null {
  const parsed = valueParser.unit(value)
  if (!parsed) return null
  const number = Number(parsed.number)
  return Number.isFinite(number) ? { number, unit: parsed.unit.toLowerCase() } : null
}

/** Pixels in a rem, as browsers use by default. */
const ROOT_FONT_SIZE = 16

/**
 * A CSS number in pixels: unitless, `px`, or `rem`. Null for `auto`, for units that depend on
 * what the value applies to (`%`, `em`, `vh`), and for anything that is not a number.
 */
export function parseCSSNumber(value: string | undefined): number | null {
  if (!value) return null
  const dimension = valueParser.unit(value.trim())
  if (!dimension) return null
  const number = Number(dimension.number)
  if (!Number.isFinite(number)) return null
  switch (dimension.unit.toLowerCase()) {
    case '':
    case 'px':
      return number
    case 'rem':
      return number * ROOT_FONT_SIZE
    default:
      return null
  }
}

/** A CSS color that paints something, as components in `profile`; null for an invalid or transparent one. */
export function parseCSSColor(
  value: string | undefined,
  profile: ColorProfile = 'srgb'
): Color | null {
  if (!value) return null
  const color = tryParseColor(value.trim(), profile)
  return color && color.a > 0 ? color : null
}

/**
 * The layers of a comma-separated CSS list, such as `box-shadow` or `background-image`, split at
 * its top-level commas, each without its spaces and comments.
 */
export function cssLayerNodes(nodes: readonly Node[]): Node[][] {
  const layers: Node[][] = []
  let current: Node[] = []
  for (const node of nodes) {
    if (node.type === 'div' && node.value === ',') {
      layers.push(current)
      current = []
    } else if (node.type !== 'space' && node.type !== 'comment') {
      current.push(node)
    }
  }
  layers.push(current)
  return layers
}

/** The layers of a comma-separated CSS list as text, each its parts joined by single spaces. */
export function splitCSSLayers(value: string): string[] {
  return cssLayerNodes(valueParser(value).nodes).map((layer) =>
    layer.map((node) => valueParser.stringify(node)).join(' ')
  )
}

/** The space-separated parts of a CSS value, keeping functions such as `rgb(0, 0, 0)` whole. */
export function splitCSSValue(value: string): string[] {
  return valueParser(value)
    .nodes.filter((node) => node.type !== 'space' && node.type !== 'comment')
    .map((node) => valueParser.stringify(node))
}

/**
 * The id of the element a reference points to in its own document, as `href="#mark"` and
 * `url(#clip)` point, decoded; null for a reference to another file or without a fragment.
 */
export function parseFragmentReference(reference: string | null | undefined): string | null {
  if (!reference) return null
  const { pathname, search, hash } = parsePath(reference.trim())
  if (pathname || search || hash.length < 2) return null
  return decode(hash.slice(1))
}

/** What each `url()` in a CSS value points at, quoted or not, such as an image's data URL. */
export function parseCSSURLs(value: string | undefined): string[] {
  const urls: string[] = []
  if (!value) return urls
  valueParser(value).walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return true
    const target = node.nodes.at(0)?.value
    if (target) urls.push(target)
    return false
  })
  return urls
}

/**
 * What a paint written as `url(#id) fallback` falls back to when its reference cannot be used:
 * the value without its `url()`, or undefined when nothing follows it, which paints nothing.
 */
export function parsePaintFallback(value: string): string | undefined {
  const rest = valueParser
    .stringify(
      valueParser(value).nodes.filter(
        (node) => node.type !== 'function' || node.value.toLowerCase() !== 'url'
      )
    )
    .trim()
  return rest || undefined
}

/**
 * The ids a CSS value points at with local `url(#id)` references, as `clip-path`, `mask`,
 * `filter`, and SVG paints do, quoted or not.
 */
export function parseCSSURLReferences(value: string | undefined): string[] {
  return compact(parseCSSURLs(value).map(parseFragmentReference))
}
