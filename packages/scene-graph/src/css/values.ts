import valueParser from 'postcss-value-parser'

import { tryParseColor } from '../color'
import type { Color } from '../primitives'

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

/** A CSS color that paints something; null for an invalid or fully transparent one. */
export function parseCSSColor(value: string | undefined): Color | null {
  if (!value) return null
  const color = tryParseColor(value.trim())
  return color && color.a > 0 ? color : null
}

/** The space-separated parts of a CSS value, keeping functions such as `rgb(0, 0, 0)` whole. */
export function splitCSSValue(value: string): string[] {
  return valueParser(value)
    .nodes.filter((node) => node.type !== 'space' && node.type !== 'comment')
    .map((node) => valueParser.stringify(node))
}
