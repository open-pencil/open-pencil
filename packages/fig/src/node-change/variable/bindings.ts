import { effectiveFigmaRawNodeFields } from '#fig/source-metadata'
import { invert } from 'es-toolkit/object'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type {
  SceneNode,
  SceneGraph,
  TextBindableField,
  TextBoundVariables
} from '@open-pencil/scene-graph'
import { boundNumberValue, isNumericVariableBindingField } from '@open-pencil/scene-graph/variables'

import { cloneRecord } from '../clone'
import { linearVariableExpression } from './expression'

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
  text: 'TEXT_DATA',
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

export interface VariableConsumptionSource extends Record<string, unknown> {
  variableConsumptionMap?: { entries?: VariableConsumptionEntry[] }
  parameterConsumptionMap?: unknown
}

/** Modern parameter entries follow legacy entries and can explicitly clear them. */
/**
 * A bound opacity is authored as a percentage and stored as a unit fraction, so every
 * conversion between the two forms goes through this factor.
 */
const OPACITY_UNIT_PER_PERCENT = 0.01

/** Only an alias or an expression carries a variable reference worth resolving. */
export function referencesVariable(dataType: string | undefined): boolean {
  return dataType === 'ALIAS' || dataType === 'EXPRESSION'
}

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
    if (index < 0) entries.push(cloneRecord(entry))
    else entries[index] = cloneRecord(entry)
  }
  // VariableDataMap carries nothing but its entries, so the merged list is the whole map.
  return { parameterConsumptionMap: { entries } }
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
  return consumptionEntry(variableField, variableId, graph, ids, multiplier, expression)
}

/** Kiwi's field for each text field a range of characters binds, where Kiwi has one. */
export const TEXT_RUN_BINDING_FIELDS = {
  fontFamily: 'FONT_FAMILY',
  fontStyle: 'FONT_STYLE',
  fontSize: 'FONT_SIZE',
  letterSpacing: 'LETTER_SPACING',
  lineHeight: 'LINE_HEIGHT',
  paragraphSpacing: 'PARAGRAPH_SPACING',
  paragraphIndent: 'PARAGRAPH_INDENT'
} as const satisfies Partial<Record<TextBindableField, string>>

const TEXT_RUN_BINDING_FIELDS_INVERSE: Partial<Record<string, TextBindableField>> =
  invert(TEXT_RUN_BINDING_FIELDS)

/** The entries a range of characters' bindings are written with, in its style override. */
export function textRunVariableEntries(
  bound: TextBoundVariables,
  graph: SceneGraph,
  ids?: Map<string, GUID>
): VariableConsumptionEntry[] {
  return Object.entries(bound).flatMap(([field, variableId]) => {
    const variableField = (TEXT_RUN_BINDING_FIELDS as Partial<Record<string, string>>)[field]
    if (!variableField || !variableId || !graph.variables.has(variableId)) return []
    return [consumptionEntry(variableField, variableId, graph, ids)]
  })
}

/** The text fields a style override binds, by variable ID. */
export function textRunVariableBindings(override: VariableConsumptionSource): TextBoundVariables {
  const bound: TextBoundVariables = {}
  for (const entry of variableConsumptionEntries(override)) {
    const field = entry.variableField && TEXT_RUN_BINDING_FIELDS_INVERSE[entry.variableField]
    const guid = field ? linearVariableExpression(entry.variableData)?.reference?.guid : undefined
    if (field && guid) bound[field] = guidToString(guid)
  }
  return bound
}

/**
 * How a record names a variable it uses, as Figma writes it: a library variable by its key,
 * even where the file holds a copy of it, and a local one by its record.
 */
export function variableAlias(
  graph: SceneGraph,
  variableId: string,
  ids?: ReadonlyMap<string, GUID>
): { guid: GUID } | { assetRef: { key: string; version?: string } } {
  const variable = graph.variables.get(variableId)
  if (variable?.key) {
    return {
      assetRef: { key: variable.key, ...(variable.version ? { version: variable.version } : {}) }
    }
  }
  return { guid: ids?.get(variableId) ?? stringToGuid(variableId) }
}

function consumptionEntry(
  variableField: string,
  variableId: string | undefined,
  graph: SceneGraph,
  ids?: Map<string, GUID>,
  multiplier = 1,
  expression = false
): VariableConsumptionEntry {
  if (!variableId) return { variableField }
  const variable = graph.variables.get(variableId)
  if (!variable) throw new Error(`Missing bound variable ${variableId}`)
  if (!Number.isFinite(multiplier)) throw new Error('Non-finite variable binding multiplier')
  const alias = {
    dataType: 'ALIAS',
    resolvedDataType: variable.type,
    value: { alias: variableAlias(graph, variableId, ids) }
  }
  // Figma's layer panel tests a variable bound to visibility with IS_TRUTHY, and writes a number
  // or boolean bound to text content as STRINGIFY.
  let conversion: 'IS_TRUTHY' | 'STRINGIFY' | undefined
  if (variableField === 'VISIBLE') conversion = 'IS_TRUTHY'
  else if (variableField === 'TEXT_DATA' && variable.type !== 'STRING') conversion = 'STRINGIFY'
  if (conversion) {
    return {
      variableField,
      variableData: {
        dataType: 'EXPRESSION',
        resolvedDataType: conversion === 'IS_TRUTHY' ? 'BOOLEAN' : 'STRING',
        value: {
          expressionValue: { expressionFunction: conversion, expressionArguments: [alias] }
        }
      }
    }
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
  if (field === 'opacity') return OPACITY_UNIT_PER_PERCENT
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
    if (!referencesVariable(entry.variableData?.dataType)) continue
    const field = entry.variableField && VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
    if (field) fields.add(field)
  }
  return [...fields].flatMap((field) => {
    const multiplier =
      (node.variableBindingScales[field] ?? 1) /
      (field === 'opacity' ? OPACITY_UNIT_PER_PERCENT : 1)
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
      scales[binding.field] =
        binding.multiplier * (binding.field === 'opacity' ? OPACITY_UNIT_PER_PERCENT : 1)
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
  if (field === 'opacity')
    return { opacity: Math.max(0, Math.min(1, value * OPACITY_UNIT_PER_PERCENT)) }
  return isNumericVariableBindingField(field)
    ? { [field]: boundNumberValue(field, value) }
    : undefined
}
