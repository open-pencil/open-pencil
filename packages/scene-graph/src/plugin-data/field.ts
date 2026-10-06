import * as v from 'valibot'

import type { PluginDataEntry } from '../types'

/** The plugin id OpenPencil keeps its own state under, on nodes and in `.fig` files. */
export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'

/** One OpenPencil plugin-data key. */
export interface PluginDataKey {
  readonly key: string
}

/** A plugin-data key and how its string value is read and written. */
export interface PluginDataField<T> extends PluginDataKey {
  /** The stored value, or `undefined` when it is missing or not a valid value. */
  decode(value: string | null | undefined): T | undefined
  encode(value: T): string
}

/**
 * A value stored as JSON. Invalid JSON and a wrong shape both read as missing: plugin data
 * comes from files anyone can edit, so a bad entry is ignored rather than thrown on.
 */
export function jsonPluginDataField<T>(
  key: string,
  schema: v.GenericSchema<unknown, T>
): PluginDataField<T> {
  const stored = v.pipe(v.string(), v.parseJson(), schema)
  return {
    key,
    decode(value) {
      const parsed = v.safeParse(stored, value)
      return parsed.success ? parsed.output : undefined
    },
    encode: (value) => JSON.stringify(value)
  }
}

/** A value stored as one of a fixed set of plain strings. */
export function textPluginDataField<const T extends string>(
  key: string,
  values: readonly T[]
): PluginDataField<T> {
  const schema = v.picklist(values)
  return {
    key,
    decode(value) {
      const parsed = v.safeParse(schema, value)
      return parsed.success ? parsed.output : undefined
    },
    encode: (value) => value
  }
}

export function isPluginDataEntry(entry: PluginDataEntry, field: PluginDataKey): boolean {
  return entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === field.key
}

export function hasPluginData(
  entries: readonly PluginDataEntry[] | undefined,
  field: PluginDataKey
): boolean {
  return entries?.some((entry) => isPluginDataEntry(entry, field)) ?? false
}

export function readPluginData<T>(
  entries: readonly PluginDataEntry[] | undefined,
  field: PluginDataField<T>
): T | undefined {
  return field.decode(entries?.find((entry) => isPluginDataEntry(entry, field))?.value)
}

/** Every valid value of a field kept as several entries under one key. */
export function readAllPluginData<T>(
  entries: readonly PluginDataEntry[] | undefined,
  field: PluginDataField<T>
): T[] {
  return (entries ?? []).flatMap((entry) => {
    if (!isPluginDataEntry(entry, field)) return []
    const value = field.decode(entry.value)
    return value === undefined ? [] : [value]
  })
}

export function pluginDataEntry<T>(field: PluginDataField<T>, value: T): PluginDataEntry {
  return { pluginId: OPEN_PENCIL_PLUGIN_ID, key: field.key, value: field.encode(value) }
}

/** Entries other than those of `fields`; other plugins' entries are always kept. */
export function withoutPluginData(
  entries: readonly PluginDataEntry[],
  fields: readonly PluginDataKey[]
): PluginDataEntry[] {
  return entries.filter((entry) => !fields.some((field) => isPluginDataEntry(entry, field)))
}

/** Entries with `field` set to `value`, appended last; `undefined` removes the field. */
export function withPluginData<T>(
  entries: readonly PluginDataEntry[],
  field: PluginDataField<T>,
  value: T | undefined
): PluginDataEntry[] {
  return withAllPluginData(entries, field, value === undefined ? [] : [value])
}

/** Entries with every entry of `field` replaced by one per value. */
export function withAllPluginData<T>(
  entries: readonly PluginDataEntry[],
  field: PluginDataField<T>,
  values: readonly T[]
): PluginDataEntry[] {
  return [
    ...withoutPluginData(entries, [field]),
    ...values.map((value) => pluginDataEntry(field, value))
  ]
}
