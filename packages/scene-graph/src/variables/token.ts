import { omit } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type { TokenExpression, TokenUnit, Variable, VariableValue } from '../types'

/** `rem` tokens are stored in canvas pixels and shown against this root font size. */
export const ROOT_FONT_SIZE_PX = 16

/** The stored number for a value typed in a unit: `1.5` in `rem` is 24 canvas pixels. */
export function tokenNumberFromUnit(value: number, unit: TokenUnit): number {
  return unit === 'rem' ? value * ROOT_FONT_SIZE_PX : value
}

/** A stored number as it reads in its unit: 24 canvas pixels in `rem` is `1.5`. */
export function tokenNumberInUnit(value: number, unit: TokenUnit): number {
  return unit === 'rem' ? value / ROOT_FONT_SIZE_PX : value
}

/**
 * A CSS expression outlives edits to its mode's value, whatever the value becomes; it records the
 * value only while that is a plain number.
 */
export function tokenExpressionForValue(
  expression: TokenExpression | undefined,
  value: VariableValue
): TokenExpression | undefined {
  if (!expression) return undefined
  return typeof value === 'number'
    ? { css: expression.css, resolved: value }
    : { css: expression.css }
}

/** Keep a variable's CSS expression for one mode in step with that mode's new value. */
export function updateTokenExpression(variable: Variable, modeId: string, value: VariableValue) {
  const expression = tokenExpressionForValue(variable.expressions?.[modeId], value)
  const others = omit(variable.expressions ?? {}, [modeId])
  const expressions = expression ? { ...others, [modeId]: expression } : others
  if (isEmptyObject(expressions)) delete variable.expressions
  else variable.expressions = expressions
}
