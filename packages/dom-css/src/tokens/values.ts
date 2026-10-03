import {
  tokenNumberInUnit,
  type TokenUnit,
  type Variable,
  type VariableScope
} from '@open-pencil/scene-graph'

import { variableNamespace } from './names'

const UNITLESS_SCOPES = new Set<VariableScope>(['OPACITY', 'FONT_STYLE', 'FONT_VARIATIONS'])

/**
 * The unit a FLOAT token is written in. An explicit unit wins; opacity and font weights are
 * unitless; every other number is a pixel length, which is what the canvas draws.
 */
export function variableUnit(variable: Variable): TokenUnit {
  if (variable.type !== 'FLOAT') return 'none'
  if (variable.unit) return variable.unit
  const scopes = variable.scopes ?? []
  if (scopes.length > 0 && scopes.every((scope) => UNITLESS_SCOPES.has(scope))) return 'none'
  return variableNamespace(variable) === 'font-weight' ? 'none' : 'px'
}

function trimNumber(value: number): string {
  return String(Number(value.toFixed(4)))
}

/** A stored number written in its unit: 24 as `rem` is `1.5rem`, 150 as `ms` is `150ms`. */
export function tokenNumberToCSS(value: number, unit: TokenUnit): string {
  const number = trimNumber(tokenNumberInUnit(value, unit))
  if (unit === 'none' || number === '0') return number
  return `${number}${unit}`
}
