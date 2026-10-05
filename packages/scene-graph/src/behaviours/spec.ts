import { omitBy } from 'es-toolkit/object'
import * as v from 'valibot'

import type { SceneGraph } from '../index'
import type { ComponentPropertyDefinition, SceneNode } from '../types'
import { BEHAVIOUR_KINDS, behaviourContract, type BehaviourKind } from './kinds'
import {
  behaviourProperties,
  emptyBehaviour,
  guessInteractionStates,
  textBinding,
  type Behaviour,
  type BehaviourNumberSettings
} from './model'
import { interactionStateValues, isNumberRange } from './schema'

/**
 * A behaviour as scripts, tools, and JSX write it: component properties and slots by name, not
 * by id. Values are boolean or text values by their contract id; numbers are a slider's or
 * number field's own range.
 */
export const behaviourSpecSchema = v.object({
  kind: v.picklist(BEHAVIOUR_KINDS),
  values: v.optional(
    v.record(
      v.string(),
      v.union([
        v.string(),
        v.object({ property: v.string(), on: v.optional(v.string()), off: v.optional(v.string()) })
      ])
    )
  ),
  numbers: v.optional(
    v.record(
      v.string(),
      v.object({
        min: v.optional(v.number()),
        max: v.optional(v.number()),
        step: v.optional(v.number()),
        default: v.optional(v.number())
      })
    )
  ),
  parts: v.optional(v.record(v.string(), v.string())),
  states: v.optional(
    v.union([v.string(), v.object({ property: v.string(), ...interactionStateValues })])
  )
})

export type BehaviourSpec = v.InferOutput<typeof behaviourSpecSchema>

/** Variant values that usually mean on, compared case-insensitively. */
const ON_NAMES = ['on', 'true', 'yes', 'checked', 'pressed', 'open', 'selected', 'active']
const OFF_NAMES = ['off', 'false', 'no', 'unchecked', 'closed', 'default', 'inactive']

function named(names: readonly string[], options: readonly string[]): string | undefined {
  return options.find((option) => names.includes(option.trim().toLowerCase()))
}

/**
 * The variant values that likely mean on and off: names such as On, True, or Checked first,
 * then the values in order.
 */
export function guessOnOff(
  options: readonly string[],
  explicit: { on?: string; off?: string } = {}
): { on?: string; off?: string } {
  const on = explicit.on ?? named(ON_NAMES, options) ?? options[0]
  const off = explicit.off ?? named(OFF_NAMES, options) ?? options.find((option) => option !== on)
  return { on, off }
}

function findProperty(
  properties: readonly ComponentPropertyDefinition[],
  name: string,
  types: readonly ComponentPropertyDefinition['type'][],
  what: string
): ComponentPropertyDefinition {
  const found = properties.find((item) => item.name === name && types.includes(item.type))
  if (found) return found
  const available = properties.filter((item) => types.includes(item.type)).map((item) => item.name)
  throw new Error(
    `${what} needs a ${types.join(' or ')} property named "${name}"; the component has ${
      available.length ? available.map((item) => `"${item}"`).join(', ') : 'none'
    }`
  )
}

type ValueBinding = NonNullable<BehaviourSpec['values']>[string]
type StatesSpec = NonNullable<BehaviourSpec['states']>

function listed(items: readonly { id: string }[]): string {
  return items.map((item) => `"${item.id}"`).join(', ')
}

/** Bind a boolean or text value to the property named in its binding. */
function resolveValue(
  behaviour: Behaviour,
  properties: readonly ComponentPropertyDefinition[],
  valueId: string,
  binding: ValueBinding
): void {
  const contract = behaviourContract(behaviour.kind)
  const bindable = contract.values.filter((item) => item.type === 'boolean' || item.type === 'text')
  const value = bindable.find((item) => item.id === valueId)
  if (!value)
    throw new Error(
      `A ${behaviour.kind} has no boolean or text value "${valueId}"; it has ${listed(bindable)}`
    )
  const name = typeof binding === 'string' ? binding : binding.property
  if (value.type === 'text') {
    behaviour.texts[valueId] = { propertyId: findProperty(properties, name, ['TEXT'], valueId).id }
    return
  }
  const definition = findProperty(properties, name, ['VARIANT', 'BOOLEAN'], valueId)
  if (definition.type === 'BOOLEAN') {
    behaviour.booleans[valueId] = { propertyId: definition.id }
    return
  }
  const options = definition.variantOptions ?? []
  const explicit: { on?: string; off?: string } = typeof binding === 'string' ? {} : binding
  const { on, off } = guessOnOff(options, explicit)
  for (const choice of [on, off])
    if (choice !== undefined && !options.includes(choice))
      throw new Error(`"${definition.name}" has no value "${choice}"; it has ${options.join(', ')}`)
  behaviour.booleans[valueId] = { propertyId: definition.id, on, off }
}

function resolveStates(
  behaviour: Behaviour,
  properties: readonly ComponentPropertyDefinition[],
  states: StatesSpec
): void {
  const name = typeof states === 'string' ? states : states.property
  const definition = findProperty(properties, name, ['VARIANT'], 'states')
  const guessed = guessInteractionStates(definition.id, definition.variantOptions ?? [])
  if (typeof states === 'string') {
    behaviour.states = guessed
    return
  }
  const { property: _property, ...values } = states
  behaviour.states = { ...guessed, ...stripUndefined(values) }
}

/**
 * The stored behaviour for a spec, with names resolved to the owner's property and slot ids. A
 * name the component lacks, a value the kind does not have, or a variant value the property
 * does not offer fails with a message naming what exists.
 */
export function behaviourFromSpec(
  graph: SceneGraph,
  owner: SceneNode,
  spec: BehaviourSpec
): Behaviour {
  const contract = behaviourContract(spec.kind)
  const properties = behaviourProperties(graph, owner)
  const behaviour = emptyBehaviour(spec.kind)
  for (const [valueId, binding] of Object.entries(spec.values ?? {}))
    resolveValue(behaviour, properties, valueId, binding)
  const numbers = contract.values.filter((item) => item.type === 'number')
  for (const [valueId, settings] of Object.entries(spec.numbers ?? {})) {
    if (!numbers.some((item) => item.id === valueId))
      throw new Error(`A ${spec.kind} has no number value "${valueId}"; it has ${listed(numbers)}`)
    const range = { ...behaviour.numbers[valueId], ...stripUndefined(settings) }
    if (!isNumberRange(range))
      throw new Error(`"${valueId}" needs max above min and a positive step`)
    behaviour.numbers[valueId] = range
  }
  for (const [partId, slotName] of Object.entries(spec.parts ?? {})) {
    if (!contract.parts.some((item) => item.id === partId))
      throw new Error(`A ${spec.kind} has no part "${partId}"; it has ${listed(contract.parts)}`)
    behaviour.parts[partId] = findProperty(properties, slotName, ['SLOT'], partId).id
  }
  if (spec.states !== undefined) resolveStates(behaviour, properties, spec.states)
  return behaviour
}

function stripUndefined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return omitBy(record, (value) => value === undefined)
}

/** The spec a stored behaviour reads as, with ids back to names; unresolved bindings are left out. */
export function behaviourToSpec(
  graph: SceneGraph,
  owner: SceneNode,
  behaviour: Behaviour
): BehaviourSpec {
  const properties = behaviourProperties(graph, owner)
  const nameOf = (id: string | undefined) => properties.find((item) => item.id === id)?.name
  const values: NonNullable<BehaviourSpec['values']> = {}
  for (const [valueId, binding] of Object.entries(behaviour.booleans)) {
    const name = nameOf(binding.propertyId)
    if (name)
      values[valueId] =
        binding.on || binding.off ? { property: name, on: binding.on, off: binding.off } : name
  }
  for (const valueId of Object.keys(behaviour.texts)) {
    const name = nameOf(textBinding(behaviour, valueId))
    if (name) values[valueId] = name
  }
  const parts = Object.fromEntries(
    Object.entries(behaviour.parts).flatMap(([partId, id]) => {
      const name = nameOf(id)
      return name ? [[partId, name]] : []
    })
  )
  const statesName = nameOf(behaviour.states?.propertyId)
  const spec: BehaviourSpec = { kind: behaviour.kind }
  if (Object.keys(values).length) spec.values = values
  if (Object.keys(behaviour.numbers).length) spec.numbers = structuredClone(behaviour.numbers)
  if (Object.keys(parts).length) spec.parts = parts
  if (behaviour.states && statesName)
    spec.states = {
      ...stripUndefined({ ...behaviour.states, propertyId: undefined }),
      property: statesName
    }
  return spec
}

export type { BehaviourKind, BehaviourNumberSettings }
