import { invert } from 'es-toolkit'

import type { VariableFormulaOperator } from '@open-pencil/scene-graph'

/** The `ExpressionFunction` Figma saves for each formula operator. */
const FIGMA_FORMULA_FUNCTIONS = {
  add: 'ADDITION',
  subtract: 'SUBTRACTION',
  multiply: 'MULTIPLY',
  divide: 'DIVIDE',
  negate: 'NEGATE',
  equal: 'EQUALS',
  notEqual: 'NOT_EQUAL',
  less: 'LESS_THAN',
  lessOrEqual: 'LESS_THAN_OR_EQUAL',
  greater: 'GREATER_THAN',
  greaterOrEqual: 'GREATER_THAN_OR_EQUAL',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  text: 'STRINGIFY',
  truthy: 'IS_TRUTHY',
  if: 'TERNARY'
} as const satisfies Record<VariableFormulaOperator, string>

const FORMULA_OPERATORS_BY_FUNCTION: Partial<Record<string, VariableFormulaOperator>> =
  invert(FIGMA_FORMULA_FUNCTIONS)

export function figmaFormulaFunction(operator: VariableFormulaOperator): string {
  return FIGMA_FORMULA_FUNCTIONS[operator]
}

/** The formula operator a saved `ExpressionFunction` is, when it is one. */
export function formulaOperatorOfFigmaFunction(
  name: string | undefined
): VariableFormulaOperator | undefined {
  return name === undefined ? undefined : FORMULA_OPERATORS_BY_FUNCTION[name]
}
