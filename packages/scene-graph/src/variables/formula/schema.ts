import {
  VARIABLE_FORMULA_OPERATORS,
  type VariableFormula,
  type VariableFormulaNode
} from '#scene-graph/types'
import * as v from 'valibot'

import { variableAliasSchema } from '../schema'
import { inferFormulaType } from './check'
import { formulaArity } from './signatures'
import { MAX_FORMULA_DEPTH } from './tree'

type NodeSchema = v.GenericSchema<unknown, VariableFormulaNode>

const finiteNumberSchema = v.pipe(v.number(), v.finite())
const booleanSchema = v.boolean()
const stringSchema = v.string()
const colorSchema = v.object({
  r: finiteNumberSchema,
  g: finiteNumberSchema,
  b: finiteNumberSchema,
  a: finiteNumberSchema
})

/**
 * A bounded recursive schema rejects excessively deep data before traversing it. Each node's
 * schema is picked by its shape rather than tried in turn, which would build an issue for
 * every literal kind an operation is not.
 */
function nodeSchema(depth: number, cache: Map<number, NodeSchema>): NodeSchema {
  const cached = cache.get(depth)
  if (cached) return cached
  const operation =
    depth > 0
      ? v.pipe(
          v.object({
            operator: v.picklist(VARIABLE_FORMULA_OPERATORS),
            operands: v.pipe(v.array(nodeSchema(depth - 1, cache)), v.minLength(1), v.maxLength(3))
          }),
          v.check(
            (node) => node.operands.length === formulaArity(node.operator),
            'Wrong number of operands'
          )
        )
      : undefined
  const schema: NodeSchema = v.lazy((input) => {
    if (typeof input === 'number') return finiteNumberSchema
    if (typeof input === 'boolean') return booleanSchema
    if (typeof input === 'string') return stringSchema
    if (typeof input === 'object' && input !== null && 'operator' in input && operation)
      return operation
    if (typeof input === 'object' && input !== null && 'aliasId' in input)
      return variableAliasSchema
    return colorSchema
  })
  cache.set(depth, schema)
  return schema
}

/** Operand types are checked where the data shows them; a reference fits any operand. */
function fitsType(formula: VariableFormula) {
  try {
    const type = inferFormulaType(formula.value)
    return type === undefined || type === formula.type
  } catch {
    return false
  }
}

export const variableFormulaSchema: v.GenericSchema<unknown, VariableFormula> = v.pipe(
  v.object({
    expression: v.literal('FORMULA'),
    type: v.picklist(['FLOAT', 'BOOLEAN', 'STRING', 'COLOR']),
    value: nodeSchema(MAX_FORMULA_DEPTH, new Map())
  }),
  v.check(fitsType, 'Formula operands do not fit their operators')
)
