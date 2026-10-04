import { mapKeys } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  TOKEN_UNITS,
  type PluginDataEntry,
  type Variable,
  type VariableCollection,
  type VariableValue
} from '@open-pencil/scene-graph'

import { getOpenPencilPluginValue, OPEN_PENCIL_PLUGIN_ID } from '../plugin-data'

/** Token fields Figma has no slot for, on each VARIABLE. */
export const TOKEN_PLUGIN_KEY = 'token'
/** Mode conditions by mode id, on each VARIABLE_SET. */
export const MODE_CONDITIONS_PLUGIN_KEY = 'modeConditions'

// Shape only. Whether a string is valid CSS is checked where it is written into a stylesheet.
const cssText = v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(1000))

// Plugin data is a JSON string; invalid JSON is an issue like any wrong shape, never a throw.
const TokenJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    unit: v.optional(v.picklist(TOKEN_UNITS)),
    expressions: v.optional(
      v.record(v.string(), v.object({ css: cssText, resolved: v.pipe(v.number(), v.finite()) }))
    )
  })
)
const ModeConditionsJSON = v.pipe(v.string(), v.parseJson(), v.record(v.string(), cssText))

type TokenFields = Pick<Variable, 'unit' | 'expressions'>

/** Plugin data other than the entries this module owns, which are rebuilt on every save. */
export function withoutTokenPluginData(pluginData: PluginDataEntry[]): PluginDataEntry[] {
  return pluginData.filter(
    (entry) =>
      entry.pluginId !== OPEN_PENCIL_PLUGIN_ID ||
      (entry.key !== TOKEN_PLUGIN_KEY && entry.key !== MODE_CONDITIONS_PLUGIN_KEY)
  )
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
  const parsed = v.safeParse(TokenJSON, getOpenPencilPluginValue(nc, TOKEN_PLUGIN_KEY))
  const token = parsed.success ? parsed.output : {}
  const expressions = Object.entries(token.expressions ?? {}).filter(([mode, expression]) =>
    sameNumber(valuesByMode[mode], expression.resolved)
  )
  return { unit: token.unit, expressions: nonEmpty(Object.fromEntries(expressions)) }
}

export function readModeConditions(nc: NodeChange): Record<string, string> {
  const parsed = v.safeParse(
    ModeConditionsJSON,
    getOpenPencilPluginValue(nc, MODE_CONDITIONS_PLUGIN_KEY)
  )
  return parsed.success ? parsed.output : {}
}

function entry(key: string, value: object): PluginDataEntry {
  return { pluginId: OPEN_PENCIL_PLUGIN_ID, key, value: JSON.stringify(value) }
}

/** Mode ids in the file differ from the model's, so callers map them. */
export function tokenPluginData(
  variable: Variable,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const token = {
    unit: variable.unit,
    expressions: nonEmpty(mapKeys(variable.expressions ?? {}, (_, mode) => modeKey(mode)))
  }
  if (!token.unit && !token.expressions) return undefined
  return entry(TOKEN_PLUGIN_KEY, token)
}

export function modeConditionsPluginData(
  collection: VariableCollection,
  modeKey: (modeId: string) => string
): PluginDataEntry | undefined {
  const conditions = collection.modes.flatMap((mode) =>
    mode.condition ? [[modeKey(mode.modeId), mode.condition] as const] : []
  )
  return conditions.length > 0
    ? entry(MODE_CONDITIONS_PLUGIN_KEY, Object.fromEntries(conditions))
    : undefined
}
