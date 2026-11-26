import type { Easing, TokenUnit, Variable, VariableScope } from '@open-pencil/scene-graph'
import { easingBezier, tokenNumberInUnit } from '@open-pencil/scene-graph/variables'

import { variableNamespace } from './names'

const UNITLESS_SCOPES = new Set<VariableScope>(['OPACITY', 'FONT_STYLE', 'FONT_VARIATIONS'])

/**
 * A property that takes values in each token unit, where a browser checks or computes a CSS
 * expression written for the token: `scale` takes any plain number, `width` any length.
 */
export const TOKEN_UNIT_PROPERTY: Record<TokenUnit, string> = {
  none: 'scale',
  px: 'width',
  rem: 'width',
  '%': 'width',
  ms: 'transition-duration',
  s: 'transition-duration',
  deg: 'rotate'
}

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

/** Six decimals keep `rem` exact for every pixel step down to 1/1024px (0.5px is 0.03125rem). */
function trimNumber(value: number): string {
  return String(Number(value.toFixed(6)))
}

/** A stored number written in its unit: 24 as `rem` is `1.5rem`, 150 as `ms` is `150ms`. */
export function tokenNumberToCSS(value: number, unit: TokenUnit): string {
  const number = trimNumber(tokenNumberInUnit(value, unit))
  if (unit === 'none' || number === '0') return number
  return `${number}${unit}`
}

/**
 * A timing, which is held in seconds, in milliseconds as Figma shows it: 0.25 is `250ms`. Files
 * keep 32-bit floats, so 0.2 comes back as 0.200000003; a hundredth of a millisecond is as fine
 * as a timing goes. CSS takes no time without its unit, so 0 is `0ms`.
 */
export function timingToCSS(seconds: number): string {
  return `${Number((seconds * 1000).toFixed(2))}ms`
}

/** The curves CSS has a keyword for, by their numbers. */
const EASING_KEYWORDS: Record<string, string> = {
  '0,0,1,1': 'linear',
  '0.42,0,1,1': 'ease-in',
  '0,0,0.58,1': 'ease-out',
  '0.42,0,0.58,1': 'ease-in-out'
}

/**
 * An easing as a CSS timing function: a keyword where CSS has one, else `cubic-bezier()`, and a
 * hold as `step-end`. A spring has no CSS timing function and gives nothing.
 */
export function easingToCSS(easing: Easing): string | undefined {
  if (easing.easing === 'HOLD') return 'step-end'
  const bezier = easingBezier(easing)
  if (!bezier) return undefined
  const numbers = [bezier.x1, bezier.y1, bezier.x2, bezier.y2].map(trimNumber).join(', ')
  return EASING_KEYWORDS[numbers.replaceAll(' ', '')] ?? `cubic-bezier(${numbers})`
}
