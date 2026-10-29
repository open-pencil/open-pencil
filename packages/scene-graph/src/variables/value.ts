import { compact } from 'es-toolkit/array'
import * as v from 'valibot'

import type { VariableLiteral, VariableValue, VariableUnsupportedExpression } from '../types'
import { formulaValueType } from './formula/check'
import { evaluateVariableFormula } from './formula/evaluate'
import { mapFormulaReferences, VariableFormulaError } from './formula/tree'
import { variableColorExpressionSchema } from './schema'

export function isUnsupportedVariableValue(
  value: VariableValue | undefined
): value is VariableUnsupportedExpression {
  return typeof value === 'object' && 'expression' in value && value.expression === 'UNSUPPORTED'
}

/** All references in one definition, including color and opacity operands. */
export function variableValueReferences(value: VariableValue): string[] {
  if (isUnsupportedVariableValue(value)) return compact(value.references)
  if (typeof value !== 'object') return []
  if ('aliasId' in value) return [value.aliasId]
  if ('expression' in value && value.expression === 'FORMULA') {
    const references: string[] = []
    mapFormulaReferences(value.value, (id) => {
      references.push(id)
      return id
    })
    return references
  }
  if ('expression' in value)
    return [...variableValueReferences(value.color), ...variableValueReferences(value.opacity)]
  return []
}

/** Clone a value while remapping its references for transfer to another document. */
export function mapVariableValueReferences(
  value: VariableValue,
  map: (id: string) => string,
  mapMode: (id: string) => string = (id) => id
): VariableValue {
  if (isUnsupportedVariableValue(value))
    return {
      ...structuredClone(value),
      references: value.references.map((id) => (id === null ? null : map(id))),
      modes: value.modes.map(mapMode)
    }
  if (typeof value !== 'object') return value
  if ('aliasId' in value) return { aliasId: map(value.aliasId) }
  if ('expression' in value && value.expression === 'FORMULA')
    return { ...value, value: mapFormulaReferences(value.value, map) }
  if ('expression' in value)
    return {
      expression: value.expression,
      color: 'aliasId' in value.color ? { aliasId: map(value.color.aliasId) } : { ...value.color },
      opacity:
        typeof value.opacity === 'object' ? { aliasId: map(value.opacity.aliasId) } : value.opacity
    }
  return { ...value }
}

/** Resolve operands through the caller's mode context; formula failures retain their diagnostics for the caller. */
export function resolveVariableValue(
  value: VariableValue,
  resolve: (id: string) => VariableLiteral | undefined
): VariableLiteral | undefined {
  if (isUnsupportedVariableValue(value)) return undefined
  if (typeof value !== 'object') return value
  if ('aliasId' in value) return resolve(value.aliasId)
  if (!('expression' in value)) return value
  if (value.expression === 'FORMULA') {
    // Evaluation checks every node it visits, so drawing never walks the tree twice; files are
    // checked against the full schema where they are read.
    const result = evaluateVariableFormula(value.value, resolve)
    if (formulaValueType(result) !== value.type)
      throw new VariableFormulaError('Wrong formula result type')
    return result
  }
  const expression = v.parse(variableColorExpressionSchema, value)
  const color = 'aliasId' in expression.color ? resolve(expression.color.aliasId) : expression.color
  const opacity =
    typeof expression.opacity === 'object'
      ? resolve(expression.opacity.aliasId)
      : expression.opacity
  if (
    !color ||
    typeof color !== 'object' ||
    !Object.values(color).every(Number.isFinite) ||
    typeof opacity !== 'number' ||
    !Number.isFinite(opacity)
  )
    return undefined
  return { ...color, a: Math.min(1, Math.max(0, opacity / 100)) }
}
