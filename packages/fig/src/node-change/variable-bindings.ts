import type { VariableConsumptionEntry, GUID } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import {
  isNumericVariableBindingField,
  type SceneNode,
  type SceneGraph
} from '@open-pencil/scene-graph'

import { effectiveFigmaRawNodeFields } from '../source-metadata'
import { linearVariableExpression } from './variable-expression'

export const VARIABLE_BINDING_FIELDS: Record<string, string> = {
  cornerRadius: 'CORNER_RADIUS',
  topLeftRadius: 'RECTANGLE_TOP_LEFT_CORNER_RADIUS',
  topRightRadius: 'RECTANGLE_TOP_RIGHT_CORNER_RADIUS',
  bottomLeftRadius: 'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS',
  bottomRightRadius: 'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS',
  strokeWeight: 'STROKE_WEIGHT',
  borderTopWeight: 'BORDER_TOP_WEIGHT',
  borderBottomWeight: 'BORDER_BOTTOM_WEIGHT',
  borderLeftWeight: 'BORDER_LEFT_WEIGHT',
  borderRightWeight: 'BORDER_RIGHT_WEIGHT',
  itemSpacing: 'STACK_SPACING',
  paddingLeft: 'STACK_PADDING_LEFT',
  paddingTop: 'STACK_PADDING_TOP',
  paddingRight: 'STACK_PADDING_RIGHT',
  paddingBottom: 'STACK_PADDING_BOTTOM',
  counterAxisSpacing: 'STACK_COUNTER_SPACING',
  gridRowGap: 'GRID_ROW_GAP',
  gridColumnGap: 'GRID_COLUMN_GAP',
  visible: 'VISIBLE',
  opacity: 'OPACITY',
  width: 'WIDTH',
  height: 'HEIGHT',
  minWidth: 'MIN_WIDTH',
  maxWidth: 'MAX_WIDTH',
  minHeight: 'MIN_HEIGHT',
  maxHeight: 'MAX_HEIGHT',
  x: 'X_POSITION',
  y: 'Y_POSITION',
  rotation: 'ROTATION',
  fontSize: 'FONT_SIZE',
  letterSpacing: 'LETTER_SPACING',
  lineHeight: 'LINE_HEIGHT',
  fontFamily: 'FONT_FAMILY'
}

export const VARIABLE_BINDING_FIELDS_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(VARIABLE_BINDING_FIELDS).map(([field, kiwiField]) => [kiwiField, field])
)

interface VariableConsumptionSource extends Record<string, unknown> {
  variableConsumptionMap?: { entries?: VariableConsumptionEntry[] }
  parameterConsumptionMap?: unknown
}

/** Modern parameter entries follow legacy entries and can explicitly clear them. */
export function variableConsumptionEntries(
  node: VariableConsumptionSource
): VariableConsumptionEntry[] {
  const parameters = node.parameterConsumptionMap as
    | { entries?: VariableConsumptionEntry[] }
    | undefined
  const fields = new Map<string, VariableConsumptionEntry>()
  const unkeyed: VariableConsumptionEntry[] = []
  for (const entry of [
    ...(node.variableConsumptionMap?.entries ?? []),
    ...(parameters?.entries ?? [])
  ]) {
    if (entry.variableField) fields.set(entry.variableField, entry)
    else unkeyed.push(entry)
  }
  return [...unkeyed, ...fields.values()]
}

export function mergeVariableConsumptionMaps(
  base: VariableConsumptionSource,
  patch: VariableConsumptionSource
): Record<string, unknown> {
  const incoming = variableConsumptionEntries(patch)
  if (incoming.length === 0) return {}
  const entries: VariableConsumptionEntry[] = []
  for (const entry of [...variableConsumptionEntries(base), ...incoming]) {
    const index = entry.variableField
      ? entries.findIndex((previous) => previous.variableField === entry.variableField)
      : -1
    if (index < 0) entries.push(structuredClone(entry))
    else entries[index] = structuredClone(entry)
  }
  const previous = base.parameterConsumptionMap as object | undefined
  const next = patch.parameterConsumptionMap as object | undefined
  return { parameterConsumptionMap: { ...previous, ...next, entries } }
}

export function variableBindingEntry(
  field: string,
  variableId: string | undefined,
  graph: SceneGraph,
  ids?: Map<string, GUID>,
  multiplier = 1,
  expression = false
): VariableConsumptionEntry | undefined {
  const variableField = VARIABLE_BINDING_FIELDS[field]
  if (!variableField) return undefined
  if (!variableId) return { variableField }
  const variable = graph.variables.get(variableId)
  if (!variable) throw new Error(`Missing bound variable ${variableId}`)
  if (!Number.isFinite(multiplier)) throw new Error('Non-finite variable binding multiplier')
  const alias = {
    dataType: 'ALIAS',
    resolvedDataType: variable.type,
    value: { alias: { guid: ids?.get(variableId) ?? stringToGuid(variableId) } }
  }
  if (variable.type !== 'FLOAT' || (!expression && multiplier === 1))
    return { variableField, variableData: alias }
  return {
    variableField,
    variableData: {
      dataType: 'EXPRESSION',
      resolvedDataType: 'FLOAT',
      value: {
        expressionValue: {
          expressionFunction: 'MULTIPLY',
          expressionArguments: [
            { dataType: 'FLOAT', resolvedDataType: 'FLOAT', value: { floatValue: multiplier } },
            alias
          ]
        }
      }
    }
  }
}

function numericBindingUnit(field: string, distanceScale: number): number {
  if (field === 'opacity') return 0.01
  if (field === 'rotation') return 1
  return distanceScale
}

export function overrideVariableBindingEntry(
  field: string,
  target: SceneNode,
  owner: SceneNode,
  graph: SceneGraph,
  ids?: Map<string, GUID>
): VariableConsumptionEntry | undefined {
  const units = numericBindingUnit(field, owner.componentScale)
  const multiplier =
    target.variableBindingScales[field] === undefined
      ? 1
      : target.variableBindingScales[field] / units
  return variableBindingEntry(field, target.boundVariables[field], graph, ids, multiplier)
}

export function exportedVariableConsumptionEntries(
  node: SceneNode,
  graph: SceneGraph,
  ids?: Map<string, GUID>
): VariableConsumptionEntry[] {
  const fields = new Set(Object.keys(node.boundVariables))
  for (const entry of variableConsumptionEntries(effectiveFigmaRawNodeFields(node))) {
    if (!['ALIAS', 'EXPRESSION'].includes(entry.variableData?.dataType ?? '')) continue
    const field = entry.variableField && VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    if (field) fields.add(field)
  }
  return [...fields].flatMap((field) => {
    const multiplier = (node.variableBindingScales[field] ?? 1) / (field === 'opacity' ? 0.01 : 1)
    const entry = variableBindingEntry(
      field,
      node.boundVariables[field],
      graph,
      ids,
      multiplier,
      node.type === 'INSTANCE' && node.componentScale !== 1
    )
    return entry ? [entry] : []
  })
}

export interface ResolvedVariableConsumption {
  field: string
  variableId: string
  multiplier: number
}

export function resolveVariableConsumptionEntry(
  entry: VariableConsumptionEntry
): ResolvedVariableConsumption | undefined {
  const field = entry.variableField
    ? VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    : undefined
  if (!field) return undefined
  const expression = linearVariableExpression(entry.variableData)
  if (entry.variableData?.value?.expressionValue && !expression?.reference)
    throw new Error('Variable expression must contain one alias')
  const guid = expression?.reference?.guid
  return guid
    ? { field, variableId: guidToString(guid), multiplier: expression.multiplier }
    : undefined
}

export function sourceVariableBindingScales(
  source: VariableConsumptionSource
): Record<string, number> {
  const scales: Record<string, number> = {}
  for (const entry of variableConsumptionEntries(source)) {
    const binding = resolveVariableConsumptionEntry(entry)
    if (binding && isNumericVariableBindingField(binding.field)) {
      scales[binding.field] = binding.multiplier * (binding.field === 'opacity' ? 0.01 : 1)
    }
  }
  return scales
}

/** Omit identity conversions: most unscaled scopes need only percentage opacity units. */
export function numericVariableAssignmentScales(layoutScale = 1): Record<string, number> {
  if (layoutScale === 1) return {}
  return Object.fromEntries(
    Object.entries(numericVariableBindingScales(VARIABLE_BINDING_FIELDS, layoutScale)).filter(
      ([, scale]) => scale !== 1
    )
  )
}

/** Translate Figma numeric bindings into persistent scene-unit conversions. */
export function numericVariableBindingScales(
  bindings: Record<string, string>,
  layoutScale: number,
  declarationScales: Partial<Record<string, number>> = {}
): Record<string, number> {
  const scales: Record<string, number> = {}
  for (const field of Object.keys(bindings)) {
    if (!isNumericVariableBindingField(field)) continue
    scales[field] = declarationScales[field] ?? numericBindingUnit(field, layoutScale)
  }
  return scales
}

export function resolvedNumericBindingUpdate(
  field: string,
  value: number
): Partial<SceneNode> | undefined {
  if (field === 'opacity') return { opacity: Math.max(0, Math.min(1, value / 100)) }
  return isNumericVariableBindingField(field) ? { [field]: value } : undefined
}
