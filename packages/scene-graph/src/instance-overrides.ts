import { overridePathKey, parseOverridePathKey } from './instances/layer-ids'

export type InstanceOverrideField = string

/**
 * A layer an instance overrides: the path of component layer ids from the instance down
 * (`instances/layer-ids.ts`), or an empty path for the instance itself.
 */
export type OverridePath = readonly string[]

/**
 * What an instance changes from its component. `self` holds the instance's own fields; `layers`
 * holds the fields of the layers inside it, keyed by `overridePathKey` of their path, including
 * layers inside nested instances. Only the outermost instance records overrides; copies of
 * nested instances hold none of their own.
 */
export interface InstanceOverrideState {
  self: Map<InstanceOverrideField, unknown>
  layers: Map<string, Map<InstanceOverrideField, unknown>>
  /**
   * Overrides recorded before copies were named by their paths, keyed by the copies' own ids.
   * `migrateInstanceLayers` moves them to `layers` and removes this.
   */
  legacyCopies?: Map<string, Map<InstanceOverrideField, unknown>>
}

export function createInstanceOverrideState(): InstanceOverrideState {
  return { self: new Map(), layers: new Map() }
}

export interface SerializedOverrideValue {
  defined: boolean
  value?: unknown
}

export interface SerializedInstanceOverrideState {
  self: Array<[InstanceOverrideField, SerializedOverrideValue]>
  layers: Array<[string, Array<[InstanceOverrideField, SerializedOverrideValue]>]>
}

function serializeOverrideValue(value: unknown): SerializedOverrideValue {
  return value === undefined ? { defined: false } : { defined: true, value }
}

function deserializeOverrideValue(value: unknown): { valid: boolean; value: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, value: undefined }
  }
  if (!('defined' in value) || typeof value.defined !== 'boolean') {
    return { valid: false, value: undefined }
  }
  if (value.defined) {
    return 'value' in value
      ? { valid: true, value: value['value'] }
      : { valid: false, value: undefined }
  }
  return { valid: true, value: undefined }
}

function deserializeEntries(value: unknown): Map<InstanceOverrideField, unknown> {
  const result = new Map<InstanceOverrideField, unknown>()
  if (!Array.isArray(value)) return result
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') continue
    const decoded = deserializeOverrideValue(entry[1])
    if (decoded.valid) result.set(entry[0], decoded.value)
  }
  return result
}

export function serializeInstanceOverrideState(
  state: InstanceOverrideState
): SerializedInstanceOverrideState {
  return {
    self: [...state.self].map(([field, value]) => [field, serializeOverrideValue(value)]),
    layers: [...state.layers].map(([path, fields]) => [
      path,
      [...fields].map(([field, value]) => [field, serializeOverrideValue(value)])
    ])
  }
}

export function deserializeInstanceOverrideState(state: unknown): InstanceOverrideState {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return createInstanceOverrideState()
  }
  const self =
    'self' in state ? deserializeEntries(state.self) : new Map<InstanceOverrideField, unknown>()
  const keyed = (entries: unknown) => {
    const result = new Map<string, Map<InstanceOverrideField, unknown>>()
    if (!Array.isArray(entries)) return result
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') continue
      result.set(entry[0], deserializeEntries(entry[1]))
    }
    return result
  }
  const layers = keyed('layers' in state ? state.layers : undefined)
  if (!('descendants' in state)) return { self, layers }
  return { self, layers, legacyCopies: keyed(state.descendants) }
}

export function cloneInstanceOverrideState(state: InstanceOverrideState): InstanceOverrideState {
  const clone = (fields: ReadonlyMap<InstanceOverrideField, unknown>) =>
    new Map([...fields].map(([field, value]) => [field, structuredClone(value)]))
  return {
    self: clone(state.self),
    layers: new Map([...state.layers].map(([path, fields]) => [path, clone(fields)]))
  }
}

export interface InstanceOverrideReferenceMapper {
  node: (id: string) => string
  variable: (id: string) => string
}

/**
 * Remap runtime identities: the component layers a path names, swapped components, and bound
 * variables. Ordinary strings and source-format payloads stay opaque.
 */
export function remapInstanceOverrideState(
  state: InstanceOverrideState,
  references: InstanceOverrideReferenceMapper
): InstanceOverrideState {
  const remapValue = (field: string, value: unknown): unknown => {
    if (typeof value !== 'string') return structuredClone(value)
    if (field === 'componentId') return references.node(value)
    if (field.startsWith('boundVariables/')) return references.variable(value)
    return value
  }
  const fields = (entries: ReadonlyMap<string, unknown>) =>
    new Map([...entries].map(([field, value]) => [field, remapValue(field, value)]))
  const layers = new Map<string, Map<string, unknown>>()
  for (const [key, entries] of state.layers) {
    const mapped = overridePathKey(parseOverridePathKey(key).map(references.node))
    if (layers.has(mapped)) throw new Error(`Duplicate remapped override path ${mapped}`)
    layers.set(mapped, fields(entries))
  }
  return { self: fields(state.self), layers }
}

function fieldsAt(
  state: InstanceOverrideState,
  path: OverridePath
): Map<InstanceOverrideField, unknown> | undefined {
  return path.length === 0 ? state.self : state.layers.get(overridePathKey(path))
}

/** All fields overridden at `path`, empty when there are none. */
export function instanceOverridesAt(
  state: InstanceOverrideState,
  path: OverridePath
): ReadonlyMap<InstanceOverrideField, unknown> {
  return fieldsAt(state, path) ?? new Map()
}

export function getInstanceOverride(
  state: InstanceOverrideState,
  path: OverridePath,
  field: InstanceOverrideField
): unknown {
  return fieldsAt(state, path)?.get(field)
}

export function hasInstanceOverride(
  state: InstanceOverrideState,
  path: OverridePath,
  field: InstanceOverrideField
): boolean {
  return fieldsAt(state, path)?.has(field) ?? false
}

export function setInstanceOverride(
  state: InstanceOverrideState,
  path: OverridePath,
  field: InstanceOverrideField,
  value: unknown = true
): void {
  if (path.length === 0) {
    state.self.set(field, value)
    return
  }
  const key = overridePathKey(path)
  const fields = state.layers.get(key) ?? new Map<string, unknown>()
  fields.set(field, value)
  state.layers.set(key, fields)
}

export function deleteInstanceOverride(
  state: InstanceOverrideState,
  path: OverridePath,
  field: InstanceOverrideField
): boolean {
  const fields = fieldsAt(state, path)
  if (!fields?.delete(field)) return false
  if (path.length > 0 && fields.size === 0) state.layers.delete(overridePathKey(path))
  return true
}

export function clearInstanceOverrides(state: InstanceOverrideState): void {
  state.self.clear()
  state.layers.clear()
}

export function forEachInstanceOverride(
  state: InstanceOverrideState,
  callback: (path: OverridePath, field: InstanceOverrideField, value: unknown) => void
): void {
  for (const [field, value] of state.self) callback([], field, value)
  for (const [key, fields] of state.layers) {
    const path = parseOverridePathKey(key)
    for (const [field, value] of fields) callback(path, field, value)
  }
}
