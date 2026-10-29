import { isPlainObject } from 'es-toolkit/predicate'

import type { Color } from '@open-pencil/scene-graph/primitives'

const VAR_SYMBOL = Symbol.for('open-pencil.variable')
const MODE_SYMBOL = Symbol.for('open-pencil.variable-mode')

/** The name a collection's first mode has when `defineVars` names none, as Figma names it. */
export const DEFAULT_MODE_NAME = 'Mode 1'

/**
 * A value a variable holds in one mode: a color as a string or a `Color`, a number, a boolean,
 * or another variable, which makes it an alias.
 */
export type VariableInput = string | Color | number | boolean | DesignVariable

/** A collection as `defineVars` and `defineMode` declare it; the first mode is the default. */
export interface CollectionDefinition {
  name: string
  modes: Array<{ name: string; values: Record<string, VariableInput> }>
}

/**
 * A variable a field binds to. `defineVars` gives one its collection, which a render creates or
 * updates; `designVar` names a variable the document already has, and may name its collection.
 */
export interface DesignVariable {
  readonly [VAR_SYMBOL]: true
  /** The variable's name, or for `designVar` without a collection, its name or ID. */
  readonly name: string
  readonly collection?: CollectionDefinition | string
}

/**
 * A mode a layer shows a collection in. `defineMode` gives it the collection it declares;
 * `designMode` names a collection the document already has.
 */
export interface DesignMode {
  readonly [MODE_SYMBOL]: true
  readonly name: string
  readonly collection: CollectionDefinition | string
}

export function isVariable(value: unknown): value is DesignVariable {
  return typeof value === 'object' && value !== null && VAR_SYMBOL in value
}

export function isMode(value: unknown): value is DesignMode {
  return typeof value === 'object' && value !== null && MODE_SYMBOL in value
}

/** Whether a value can be a variable's value: a color, a number, a boolean, or a variable. */
export function isVariableInput(value: unknown): value is VariableInput {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return true
  if (isVariable(value)) return true
  return isPlainObject(value) && ['r', 'g', 'b', 'a'].every((key) => typeof value[key] === 'number')
}

/**
 * A variable the document already has: by its name or ID, or by the names of its collection and
 * itself, as `designMode` names a mode, for a name more than one collection has.
 */
export function designVar(idOrName: string): DesignVariable
export function designVar(collection: string, name: string): DesignVariable
export function designVar(first: string, second?: string): DesignVariable {
  return Object.freeze(
    second === undefined
      ? { [VAR_SYMBOL]: true as const, name: first }
      : { [VAR_SYMBOL]: true as const, name: second, collection: first }
  )
}

/**
 * Define a variable collection: its variables, by name, with their values in its first mode,
 * named `mode` (Figma's `Mode 1` by default). A render that binds any of them creates the
 * collection, or updates the one with that name, so running the JSX again changes nothing twice.
 */
export function defineVars<T extends Record<string, VariableInput>>(
  collection: string,
  values: T,
  options: { mode?: string } = {}
): { [K in keyof T]: DesignVariable } {
  const definition: CollectionDefinition = {
    name: collection,
    modes: [{ name: options.mode ?? DEFAULT_MODE_NAME, values }]
  }
  const handles = {} as { [K in keyof T]: DesignVariable }
  for (const name of Object.keys(values) as Array<keyof T & string>) {
    handles[name] = Object.freeze({ [VAR_SYMBOL]: true as const, name, collection: definition })
  }
  return handles
}

/**
 * Add a mode to a collection `defineVars` defined, with the values that differ from its first
 * mode; the rest keep the first mode's values, as a mode Figma adds copies them.
 */
export function defineMode(
  vars: Record<string, DesignVariable>,
  name: string,
  values: Record<string, VariableInput>
): DesignMode {
  const definition = Object.values(vars)[0]?.collection
  if (!definition || typeof definition === 'string')
    throw new Error('defineMode() takes the variables defineVars() returned')
  if (definition.modes.some((mode) => mode.name === name))
    throw new Error(`Collection ${definition.name} already has a mode named ${name}`)
  const known = definition.modes[0].values
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(known, key))
      throw new Error(`Collection ${definition.name} has no variable named ${key}`)
  }
  definition.modes.push({ name, values })
  return Object.freeze({ [MODE_SYMBOL]: true as const, name, collection: definition })
}

/**
 * A mode of a collection the document already has, by their names, or by the collection's ID
 * when several collections share its name.
 */
export function designMode(collection: string, mode: string): DesignMode {
  return Object.freeze({ [MODE_SYMBOL]: true as const, name: mode, collection })
}
