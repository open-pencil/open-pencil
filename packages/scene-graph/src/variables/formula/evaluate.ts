import type { VariableFormulaNode, VariableLiteral } from '#scene-graph/types'

import { checkFormulaOperands, formulaValueType } from './check'
import { applyFormulaOperator, isFormulaOperator } from './signatures'
import { foldFormula, VariableFormulaError } from './tree'

/** A finite number, or any other value a formula holds; anything else is refused. */
function checked(value: VariableLiteral): VariableLiteral {
  if (typeof value !== 'number') formulaValueType(value)
  else if (!Number.isFinite(value)) throw new VariableFormulaError('Formula result must be finite')
  return value
}

/** Every operand is evaluated, so `false and` or `if()` with an invalid operand still fails. */
export function evaluateVariableFormula(
  node: VariableFormulaNode,
  resolve: (id: string) => VariableLiteral | undefined
): VariableLiteral {
  return foldFormula<VariableLiteral>(node, {
    literal: checked,
    reference: (id) => {
      const value = resolve(id)
      if (value === undefined) throw new VariableFormulaError(`Cannot resolve variable ${id}`)
      return checked(value)
    },
    operation: ({ operator }, operands) => {
      if (!isFormulaOperator(operator))
        throw new VariableFormulaError(`Unknown formula operator ${String(operator)}`)
      checkFormulaOperands(operator, operands.map(formulaValueType))
      return checked(applyFormulaOperator(operator, operands))
    }
  })
}
