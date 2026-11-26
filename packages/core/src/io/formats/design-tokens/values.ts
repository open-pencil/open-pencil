import { variableUnit } from '@open-pencil/dom-css/export'
import type { ColorProfile, Easing, TokenUnit, Variable } from '@open-pencil/scene-graph'
import { colorToSRGBHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { easingBezier, isEasing } from '@open-pencil/scene-graph/variables'

import type { DesignTokenType } from './types'

/** Six decimals hold every value the canvas draws without float noise such as `0.30000000000000004`. */
export function trimNumber(value: number): number {
  return Number(value.toFixed(6))
}

/** A string token that names fonts and nothing else. */
function namesFontFamily(variable: Variable): boolean {
  const scopes = variable.scopes ?? []
  return scopes.length > 0 && scopes.every((scope) => scope === 'FONT_FAMILY')
}

/**
 * The DTCG type a variable is written as, chosen so Figma can import it: lengths are
 * `dimension` in px, times and timings `duration` in s, easings `cubicBezier`, other numbers and
 * booleans `number`, and text that names fonts `fontFamily`, other text `string`.
 */
export function variableTokenType(variable: Variable): DesignTokenType {
  if (variable.type === 'COLOR') return 'color'
  if (variable.type === 'TIMING') return 'duration'
  if (variable.type === 'EASING') return 'cubicBezier'
  if (variable.type === 'BOOLEAN') return 'number'
  if (variable.type === 'STRING') return namesFontFamily(variable) ? 'fontFamily' : 'string'
  const unit = variableUnit(variable)
  if (unit === 'px' || unit === 'rem') return 'dimension'
  if (unit === 'ms' || unit === 's') return 'duration'
  return 'number'
}

/**
 * A color as DTCG 2025.10 writes it: the components in the document's profile, named as DTCG
 * names it, alpha, and the sRGB hex code tools display, brought inside sRGB where it lies outside.
 */
export function colorTokenValue(color: Color, profile: ColorProfile) {
  return {
    colorSpace: profile,
    components: [trimNumber(color.r), trimNumber(color.g), trimNumber(color.b)],
    alpha: trimNumber(color.a),
    hex: colorToSRGBHex(color, profile).toLowerCase()
  }
}

/** A canvas length in px, which is how lengths are stored and how Figma reads them. */
export function dimensionTokenValue(px: number) {
  return { value: trimNumber(px), unit: 'px' }
}

/** A time in s, the one duration unit Figma reads; `ms` tokens are stored in milliseconds. */
function durationTokenValue(value: number, unit: TokenUnit) {
  return { value: trimNumber(unit === 'ms' ? value / 1000 : value), unit: 's' }
}

/** An easing's curve as DTCG's four numbers, or nothing for a spring or a hold, which it lacks. */
export function cubicBezierTokenValue(easing: Easing): number[] | undefined {
  const bezier = easingBezier(easing)
  return bezier && [bezier.x1, bezier.y1, bezier.x2, bezier.y2].map(trimNumber)
}

/** A variable's own value in the shape its token type takes; a timing is held in seconds. */
export function literalTokenValue(
  variable: Variable,
  value: Color | number | string | boolean | Easing,
  profile: ColorProfile
): unknown {
  if (isEasing(value)) return cubicBezierTokenValue(value)
  if (typeof value === 'object') return colorTokenValue(value, profile)
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') return value
  const type = variableTokenType(variable)
  if (type === 'dimension') return dimensionTokenValue(value)
  if (type === 'duration')
    return durationTokenValue(value, variable.type === 'TIMING' ? 's' : variableUnit(variable))
  return trimNumber(value)
}
