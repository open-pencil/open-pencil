import * as v from 'valibot'

import {
  VARIABLE_FORMULA_OPERATORS,
  type VariableFormulaNode
} from '@open-pencil/scene-graph/types'

import { variableAliasSchema } from '../schema'
import { MAX_FORMULA_DEPTH, formulaArity, formulaOperandType } from './evaluate'

/** A bounded recursive schema rejects excessively deep data before traversing it. */
function nodeSchema(
  type: 'FLOAT' | 'BOOLEAN',
  depth: number
): v.GenericSchema<unknown, VariableFormulaNode> {
  const literal = v.union([
    type === 'FLOAT' ? v.pipe(v.number(), v.finite()) : v.boolean(),
    variableAliasSchema
  ])
  if (depth === 0) return literal
  return v.union([
    literal,
    v.pipe(
      v.object({
        operator: v.picklist(
          VARIABLE_FORMULA_OPERATORS.filter((operator) => formulaOperandType(operator) === type)
        ),
        operands: v.pipe(v.array(nodeSchema(type, depth - 1)), v.minLength(1), v.maxLength(2))
      }),
      v.check(
        (node) => node.operands.length === formulaArity(node.operator),
        'Wrong number of operands'
      )
    )
  ])
}

export const variableFormulaSchema = v.variant('type', [
  v.object({
    expression: v.literal('FORMULA'),
    type: v.literal('FLOAT'),
    value: nodeSchema('FLOAT', MAX_FORMULA_DEPTH)
  }),
  v.object({
    expression: v.literal('FORMULA'),
    type: v.literal('BOOLEAN'),
    value: nodeSchema('BOOLEAN', MAX_FORMULA_DEPTH)
  })
])
