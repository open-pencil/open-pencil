import * as v from 'valibot'

import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  VARIABLE_FORMULA_OPERATORS,
  variableFormulaSchema,
  variableColorExpressionSchema,
  formulaOperandType,
  MAX_FORMULA_DEPTH,
  type SceneGraph,
  type VariableValue,
  type VariableColorExpression
} from '@open-pencil/scene-graph'

import { extractPluginData } from '../node-change/plugin-data'
import { readVariableMetadata } from '../node-change/variable/metadata'
import {
  readModeAttribute,
  readModeConditions,
  readVariableToken,
  withoutTokenPluginData
} from '../node-change/variable/token'
import { createResourceResolver } from './resource-reference'

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
  const operator = v.parse(v.picklist(VARIABLE_FORMULA_OPERATORS), expression?.expressionFunction)
  const type = formulaOperandType(operator)
  if (entry.resolvedDataType && entry.resolvedDataType !== type)
    throw new Error(`Expression result type does not match ${entry.resolvedDataType}`)
  const operands = (expression?.expressionArguments ?? []).map((arg) => {
    const operand = valueOf(arg, resolve, depth + 1)
    return typeof operand === 'object' &&
      'expression' in operand &&
      operand.expression === 'FORMULA'
      ? operand.value
      : operand
  })
  return v.parse(variableFormulaSchema, {
    expression: 'FORMULA',
    type,
    value: { operator, operands }
  })
}

function colorExpression(
  entry: VariableDataEntry,
  resolve: ReturnType<typeof createResourceResolver>
): VariableColorExpression {
  const expression = entry.value?.expressionValue
  const args = expression?.expressionArguments
  if (expression?.expressionFunction !== 'COMPOSE_COLOR' || args?.length !== 2)
    throw new Error(`Unsupported variable expression ${expression?.expressionFunction}`)
  // Only literal or alias operands are supported; other functions must not be flattened.
  if (args.some((arg) => arg.dataType === 'EXPRESSION'))
    throw new Error('Unsupported nested color expression')
  const color = valueOf(args[0], resolve)
  const opacity = valueOf(args[1], resolve)
  return v.parse(variableColorExpressionSchema, { expression: 'COMPOSE_COLOR', color, opacity })
}

function modeValues(
  resource: NodeChange,
  modes: readonly string[],
  resolve: ReturnType<typeof createResourceResolver>
): Record<string, VariableValue> {
  const entries = resource.variableDataValues?.entries ?? []
  if (!entries.length) throw new Error('Missing mode values')
  const values: Record<string, VariableValue> = {}
  for (const entry of entries) {
    const modeId = guidToString(entry.modeID)
    if (!modes.includes(modeId)) throw new Error('Unknown mode')
    const value = valueOf(entry.variableData, resolve)
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

/** No invented values or fallback collections: unsupported resources remain explicit. */
export function materializeVariableResources(
  graph: SceneGraph,
  resources: readonly NodeChange[],
  onUnsupported?: (resource: NodeChange) => void
): void {
  const report = (resource: NodeChange, reason: string): void => {
    if (!onUnsupported) throw new Error(`Unsupported document resource ${resource.type}: ${reason}`)
    onUnsupported(structuredClone(resource))
  }
  for (const resource of resources) {
    if (resource.type !== 'VARIABLE_SET') continue
    const modes = resource.variableSetModes ?? []
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
  addVariables(graph, resources, report)
}

function addVariables(
  graph: SceneGraph,
  resources: readonly NodeChange[],
  report: (resource: NodeChange, reason: string) => void
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
          resolve
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
