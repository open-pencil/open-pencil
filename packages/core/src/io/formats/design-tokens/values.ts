import { variableUnit } from '@open-pencil/dom-css/export'
import type { Color, TokenUnit, Variable } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

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
 * `dimension` in px, times `duration` in s, other numbers and booleans `number`, and text that
 * names fonts `fontFamily`, other text `string`.
 */
export function variableTokenType(variable: Variable): DesignTokenType {
  if (variable.type === 'COLOR') return 'color'
  if (variable.type === 'BOOLEAN') return 'number'
  if (variable.type === 'STRING') return namesFontFamily(variable) ? 'fontFamily' : 'string'
  const unit = variableUnit(variable)
  if (unit === 'px' || unit === 'rem') return 'dimension'
  if (unit === 'ms' || unit === 's') return 'duration'
  return 'number'
}

/** A color as DTCG 2025.10 writes it: sRGB components, alpha, and the hex code tools display. */
export function colorTokenValue(color: Color) {
  return {
    colorSpace: 'srgb',
    components: [trimNumber(color.r), trimNumber(color.g), trimNumber(color.b)],
    alpha: trimNumber(color.a),
    hex: colorToHex(color).toLowerCase()
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

/** A variable's own value in the shape its token type takes. */
export function literalTokenValue(
  variable: Variable,
  value: Color | number | string | boolean
): unknown {
  if (typeof value === 'object') return colorTokenValue(value)
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') return value
  const type = variableTokenType(variable)
  if (type === 'dimension') return dimensionTokenValue(value)
  if (type === 'duration') return durationTokenValue(value, variableUnit(variable))
  return trimNumber(value)
}
