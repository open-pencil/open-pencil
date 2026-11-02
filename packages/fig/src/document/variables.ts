import { sortBy } from 'es-toolkit/array'
import * as v from 'valibot'

import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type {
  SceneGraph,
  VariableFormulaNode,
  VariableValue,
  VariableColorExpression
} from '@open-pencil/scene-graph'
import {
  variableFormulaSchema,
  variableColorExpressionSchema,
  inferFormulaType,
  MAX_FORMULA_DEPTH
} from '@open-pencil/scene-graph/variables'

import { extractPluginData } from '../node-change/plugin-data'
import { formulaOperatorOfFigmaFunction } from '../node-change/variable/formula'
import { readVariableMetadata } from '../node-change/variable/metadata'
import {
  readModeAttribute,
  readModeConditions,
  readVariableToken,
  withoutTokenPluginData
} from '../node-change/variable/token'
import { mapUnsupportedExpressionReferences } from '../node-change/variable/unsupported'
import { createResourceResolver } from './resource-reference'

export interface UnsupportedVariableExpressionDiagnostic {
  sourceId: string
  modeId: string
  reason: 'unsupported-variable-expression'
}
type ExpressionReporter = (diagnostic: UnsupportedVariableExpressionDiagnostic) => void

class UnsupportedExpressionError extends Error {
  override name = 'UnsupportedExpressionError'
}

function valueOf(
  entry: VariableDataEntry,
  resolve: ReturnType<typeof createResourceResolver>,
  depth = 0
): VariableValue {
  if (depth > MAX_FORMULA_DEPTH) throw new Error('Variable expression is too deeply nested')
  const { value, dataType, resolvedDataType } = entry
  if (!value) throw new Error('Missing variable value')
  const type = dataType ?? resolvedDataType
  if (type === 'ALIAS') {
    const aliasId = resolve(value.alias)
    if (!aliasId) throw new Error('Unresolved variable alias')
    return { aliasId }
  }
  if (type === 'COLOR' && value.colorValue) return structuredClone(value.colorValue)
  if (type === 'BOOLEAN' && value.boolValue !== undefined) return value.boolValue
  if (type === 'STRING' && value.textValue !== undefined) return value.textValue
  if (type === 'FLOAT' && value.floatValue !== undefined) return value.floatValue
  if (type === 'EXPRESSION') return expressionValue(entry, resolve, depth)
  throw new Error(`Unsupported variable value ${type}`)
}

function expressionValue(
  entry: VariableDataEntry,
  resolve: ReturnType<typeof createResourceResolver>,
  depth: number
): VariableValue {
  const value = entry.value
  if (!value) throw new Error('Missing expression')
  if (value.expressionValue?.expressionFunction === 'COMPOSE_COLOR')
    return colorExpression(entry, resolve)
  const expression = value.expressionValue
  const operator = formulaOperatorOfFigmaFunction(expression?.expressionFunction)
  if (!operator) {
    if (!expression?.expressionFunction) throw new Error('Missing variable expression function')
    throw new UnsupportedExpressionError(
      `Unsupported variable expression ${expression.expressionFunction}`
    )
  }
  const operands = (expression?.expressionArguments ?? []).map((arg) => {
    // A formula needs every variable it uses; one the document lacks keeps the file's tree.
    if ((arg.dataType ?? arg.resolvedDataType) === 'ALIAS' && !resolve(arg.value?.alias))
      throw new UnsupportedExpressionError(`${operator} uses a variable this document lacks`)
    return formulaOperand(valueOf(arg, resolve, depth + 1))
  })
  const node = { operator, operands }
  // Figma writes the result type; a formula of references alone would otherwise leave it open.
  const written = v.safeParse(
    v.picklist(['FLOAT', 'BOOLEAN', 'STRING', 'COLOR']),
    entry.resolvedDataType
  )
  const formula = v.safeParse(variableFormulaSchema, {
    expression: 'FORMULA',
    type: written.success ? written.output : inferredType(node),
    value: node
  })
  // Operands Figma itself would not resolve are kept as written rather than refused.
  if (!formula.success) throw new UnsupportedExpressionError(`Invalid ${operator} expression`)
  return formula.output
}

function inferredType(node: VariableFormulaNode) {
  try {
    return inferFormulaType(node)
  } catch {
    return undefined
  }
}

/** An operand as a formula holds it; a color expression inside a formula is not one it can. */
function formulaOperand(operand: VariableValue): VariableFormulaNode {
  if (typeof operand !== 'object' || !('expression' in operand)) return operand
  if (operand.expression === 'FORMULA') return operand.value
  throw new UnsupportedExpressionError(`Unsupported nested ${operand.expression} expression`)
}

function colorExpression(
  entry: VariableDataEntry,
  resolve: ReturnType<typeof createResourceResolver>
): VariableColorExpression {
  const expression = entry.value?.expressionValue
  const args = expression?.expressionArguments
  if (expression?.expressionFunction !== 'COMPOSE_COLOR' || args?.length !== 2)
    throw new UnsupportedExpressionError(
      `Unsupported variable expression ${expression?.expressionFunction}`
    )
  // Only literal or alias operands are supported; other functions must not be flattened.
  if (args.some((arg) => arg.dataType === 'EXPRESSION'))
    throw new UnsupportedExpressionError('Unsupported nested color expression')
  const color = valueOf(args[0], resolve)
  const opacity = valueOf(args[1], resolve)
  return v.parse(variableColorExpressionSchema, { expression: 'COMPOSE_COLOR', color, opacity })
}

function modeValues(
  resource: NodeChange,
  modes: readonly string[],
  resolve: ReturnType<typeof createResourceResolver>,
  onUnsupportedExpression?: ExpressionReporter
): Record<string, VariableValue> {
  const entries = resource.variableDataValues?.entries ?? []
  if (!entries.length) throw new Error('Missing mode values')
  const values: Record<string, VariableValue> = {}
  for (const entry of entries) {
    const modeId = guidToString(entry.modeID)
    if (!modes.includes(modeId)) throw new Error('Unknown mode')
    let value: VariableValue
    try {
      value = valueOf(entry.variableData, resolve)
    } catch (error) {
      if (!(error instanceof UnsupportedExpressionError) || !onUnsupportedExpression) throw error
      const data = structuredClone(entry.variableData)
      const references: (string | null)[] = []
      const modeKeys: string[] = []
      mapUnsupportedExpressionReferences(
        data,
        (reference) => {
          references.push(resolve(reference) ?? null)
          return undefined
        },
        (guid) => {
          modeKeys.push(guidToString(guid))
          return guid
        }
      )
      value = {
        expression: 'UNSUPPORTED',
        function: data.value?.expressionValue?.expressionFunction ?? '',
        value: { ...data },
        references,
        modes: modeKeys
      }
      onUnsupportedExpression({
        sourceId: resource.guid ? guidToString(resource.guid) : '',
        modeId,
        reason: 'unsupported-variable-expression'
      })
    }
    if (
      typeof value === 'object' &&
      'expression' in value &&
      value.expression === 'FORMULA' &&
      value.type !== resource.variableResolvedType
    )
      throw new Error(`Expression result type does not match ${resource.variableResolvedType}`)
    values[modeId] = value
  }
  return values
}

type SavedMode = NonNullable<NodeChange['variableSetModes']>[number]

/** Figma lists modes by `sortPosition`; modes without one follow, in saved order. */
function modesInListedOrder(resource: NodeChange): SavedMode[] {
  return sortBy(resource.variableSetModes ?? [], [
    (mode) => !mode.sortPosition,
    (mode) => mode.sortPosition ?? ''
  ])
}

/** No invented values or fallback collections: unsupported resources remain explicit. */
export function materializeVariableResources(
  graph: SceneGraph,
  resources: readonly NodeChange[],
  onUnsupported?: (resource: NodeChange) => void,
  onUnsupportedExpression?: ExpressionReporter
): void {
  const report = (resource: NodeChange, reason: string): void => {
    if (!onUnsupported) throw new Error(`Unsupported document resource ${resource.type}: ${reason}`)
    onUnsupported(structuredClone(resource))
  }
  for (const resource of resources) {
    if (resource.type !== 'VARIABLE_SET') continue
    const modes = modesInListedOrder(resource)
    if (!resource.guid || modes.length === 0) {
      report(resource, 'missing collection identity or modes')
      continue
    }
    const pluginData = withoutTokenPluginData(extractPluginData(resource))
    const conditions = readModeConditions(resource)
    graph.addCollection({
      id: guidToString(resource.guid),
      name: resource.name ?? 'Variables',
      modes: modes.map((mode) => {
        const modeId = guidToString(mode.id)
        return {
          modeId,
          name: mode.name,
          condition: conditions[modeId],
          ...(mode.sortPosition ? { sortPosition: mode.sortPosition } : {})
        }
      }),
      defaultModeId: guidToString(modes[0].id),
      variableIds: [],
      modeAttribute: readModeAttribute(resource),
      pluginData: pluginData.length > 0 ? pluginData : undefined,
      key: typeof resource.key === 'string' ? resource.key : undefined,
      version: typeof resource.version === 'string' ? resource.version : undefined
    })
  }
  addVariables(graph, resources, report, onUnsupportedExpression)
}

function addVariables(
  graph: SceneGraph,
  resources: readonly NodeChange[],
  report: (resource: NodeChange, reason: string) => void,
  onUnsupportedExpression?: ExpressionReporter
): void {
  const resolve = createResourceResolver(resources)
  for (const resource of resources) {
    if (resource.type !== 'VARIABLE') continue
    const type = resource.variableResolvedType
    const collectionId = resource.variableSetID
      ? resolve(resource.variableSetID)
      : resource.parentIndex?.guid && guidToString(resource.parentIndex.guid)
    const collection = collectionId && graph.variableCollections.get(collectionId)
    if (
      !resource.guid ||
      !collection ||
      !collectionId ||
      (type !== 'COLOR' && type !== 'BOOLEAN' && type !== 'STRING' && type !== 'FLOAT')
    ) {
      report(resource, 'unresolved collection, identity or type')
      continue
    }
    const valuesByMode: Record<string, VariableValue> = {}
    try {
      Object.assign(
        valuesByMode,
        modeValues(
          resource,
          collection.modes.map((mode) => mode.modeId),
          resolve,
          onUnsupportedExpression
        )
      )
    } catch (error) {
      report(resource, error instanceof Error ? error.message : 'Invalid mode value')
      continue
    }
    const metadata = readVariableMetadata(resource)
    graph.addVariable({
      id: guidToString(resource.guid),
      name: resource.name ?? 'Variable',
      type,
      collectionId,
      valuesByMode,
      ...metadata,
      ...readVariableToken(resource, valuesByMode)
    })
  }
}
