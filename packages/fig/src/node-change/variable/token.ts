import { mapKeys } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  pluginDataEntry,
  withoutPluginData,
  type PluginDataEntry,
  type Variable,
  type VariableCollection,
  type VariableValue
} from '@open-pencil/scene-graph'

import { readNodeChangePluginData } from '../plugin-data'

const { token, modeConditions, modeAttribute } = OPEN_PENCIL_PLUGIN_DATA

type TokenFields = Pick<Variable, 'unit' | 'expressions'>

/** Plugin data other than the token entries, which are rebuilt on every save. */
export function withoutTokenPluginData(pluginData: PluginDataEntry[]): PluginDataEntry[] {
  return withoutPluginData(pluginData, [token, modeConditions, modeAttribute])
}

function nonEmpty<T extends object>(record: T): T | undefined {
  return isEmptyObject(record) ? undefined : record
}

/** `.fig` stores numbers as float32, so compare at that precision, not the plugin data's double. */
function sameNumber(a: VariableValue | undefined, b: number): boolean {
  return typeof a === 'number' && Math.fround(a) === Math.fround(b)
}

/**
 * The stored number stays authoritative: an expression whose mode value was edited elsewhere,
 * Figma included, no longer describes that value and is dropped rather than overriding it.
 */
export function readVariableToken(
  nc: NodeChange,
  valuesByMode: Record<string, VariableValue>
): TokenFields {
  const stored = readNodeChangePluginData(nc, token) ?? {}
  const expressions = Object.entries(stored.expressions ?? {}).filter(([mode, expression]) =>
    sameNumber(valuesByMode[mode], expression.resolved)
  )
  return { unit: stored.unit, expressions: nonEmpty(Object.fromEntries(expressions)) }
}

export function readModeConditions(nc: NodeChange): Record<string, string> {
  return readNodeChangePluginData(nc, modeConditions) ?? {}
}

export function readModeAttribute(nc: NodeChange): string | undefined {
  return readNodeChangePluginData(nc, modeAttribute)
}

export function modeAttributePluginData(
  collection: VariableCollection
): PluginDataEntry | undefined {
  return collection.modeAttribute
    ? pluginDataEntry(modeAttribute, collection.modeAttribute)
    : undefined
}

/** Mode ids in the file differ from the model's, so callers map them. */
export function tokenPluginData(
  variable: Variable,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const stored = {
    unit: variable.unit,
    expressions: nonEmpty(mapKeys(variable.expressions ?? {}, (_, mode) => modeKey(mode)))
  }
  if (!stored.unit && !stored.expressions) return undefined
  return pluginDataEntry(token, stored)
}

export function modeConditionsPluginData(
  collection: VariableCollection,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const conditions = collection.modes.flatMap((mode) =>
    mode.condition ? [[modeKey(mode.modeId), mode.condition] as const] : []
  )
  return conditions.length > 0
    ? pluginDataEntry(modeConditions, Object.fromEntries(conditions))
    : undefined
}
