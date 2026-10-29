import type { Variable, VariableLiteral, VariableValue } from '@open-pencil/scene-graph'

import { parseTokenValueText, tokenValueText, type TokenFormulaActions } from './model'

export interface TokenValueEdit {
  value: VariableValue
  resolved: VariableLiteral
  kind: 'literal' | 'reference' | 'formula'
}

/**
 * A value as the field shows it: a number in the token's unit, or formula source, where text is
 * quoted and a color is `#RRGGBB`, so that the field reads it back as the same value.
 */
export function tokenEditorText(variable: Variable, modeId: string, formula: TokenFormulaActions) {
  const value = variable.valuesByMode[modeId]
  return typeof value === 'object' || variable.type === 'STRING'
    ? formula.format(value)
    : tokenValueText(variable, value)
}

/**
 * Read the field: a plain number is typed in the token's unit, as the number field took it;
 * anything else is a formula, whose numbers are stored units.
 */
export function parseTokenEditorText(
  variable: Variable,
  modeId: string,
  source: string,
  formula: TokenFormulaActions
): TokenValueEdit {
  const text = source.trim()
  const literal = parseTokenValueText(variable, text)
  if (typeof literal === 'number') return { value: literal, resolved: literal, kind: 'literal' }
  const result = formula.parse(modeId, text)
  if (typeof result.value === 'object' && 'aliasId' in result.value)
    return { ...result, kind: 'reference' }
  const operation = typeof result.value === 'object' && 'expression' in result.value
  return { ...result, kind: operation ? 'formula' : 'literal' }
}
