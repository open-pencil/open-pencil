import type { SceneGraph } from '../index'
import { readPluginData, withPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { ComponentPropertyDefinition, SceneNode } from '../types'
import {
  behaviourContract,
  INTERACTION_STATES,
  type BehaviourKind,
  type InteractionState
} from './kinds'
import type {
  Behaviour,
  BehaviourBooleanBinding,
  BehaviourInteractionStates,
  BehaviourNumberSettings
} from './schema'

export type {
  Behaviour,
  BehaviourBooleanBinding,
  BehaviourInteractionStates,
  BehaviourNumberSettings
} from './schema'
export { isNumberRange } from './schema'

export const DEFAULT_NUMBER_SETTINGS: BehaviourNumberSettings = {
  min: 0,
  max: 100,
  step: 1,
  default: 50
}

/** A boolean value's binding, if the behaviour has one. */
export function booleanBinding(
  behaviour: Behaviour,
  valueId: string
): BehaviourBooleanBinding | undefined {
  return Object.hasOwn(behaviour.booleans, valueId) ? behaviour.booleans[valueId] : undefined
}

/** The slot property a part is bound to, if any. */
export function partBinding(behaviour: Behaviour, partId: string): string | undefined {
  return Object.hasOwn(behaviour.parts, partId) ? behaviour.parts[partId] : undefined
}

/** The text property a text value is bound to, if any. */
export function textBinding(behaviour: Behaviour, valueId: string): string | undefined {
  return Object.hasOwn(behaviour.texts, valueId) ? behaviour.texts[valueId].propertyId : undefined
}

/** A number value's range, if the behaviour has one. */
export function numberSettings(
  behaviour: Behaviour,
  valueId: string
): BehaviourNumberSettings | undefined {
  return Object.hasOwn(behaviour.numbers, valueId) ? behaviour.numbers[valueId] : undefined
}

/** A new behaviour of a kind, its number values at their defaults and nothing bound. */
export function emptyBehaviour(kind: BehaviourKind): Behaviour {
  const contract = behaviourContract(kind)
  const numbers = Object.fromEntries(
    contract.values
      .filter((value) => value.type === 'number')
      .map((value) => [value.id, { ...DEFAULT_NUMBER_SETTINGS }])
  )
  return { kind, booleans: {}, texts: {}, numbers, parts: {} }
}

/**
 * The node that keeps the behaviour: a component set for its variants, otherwise the main
 * component itself.
 */
export function behaviourOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  if (node.type === 'COMPONENT_SET') return node
  if (node.type !== 'COMPONENT') return undefined
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return parent?.type === 'COMPONENT_SET' ? parent : node
}

/** The behaviour a component or component set keeps, or null when it has none or it is unreadable. */
export function readBehaviour(owner: SceneNode): Behaviour | null {
  return readPluginData(owner.pluginData, OPEN_PENCIL_PLUGIN_DATA.behaviour) ?? null
}

/** The owner's plugin data with the behaviour set, or removed when null. */
export function withBehaviour(
  owner: SceneNode,
  behaviour: Behaviour | null
): SceneNode['pluginData'] {
  return withPluginData(owner.pluginData, OPEN_PENCIL_PLUGIN_DATA.behaviour, behaviour ?? undefined)
}

/** Component properties the behaviour can bind to: the owner's, and a set's variants' own. */
export function behaviourProperties(
  graph: SceneGraph,
  owner: SceneNode
): ComponentPropertyDefinition[] {
  const variants =
    owner.type === 'COMPONENT_SET'
      ? owner.childIds.flatMap((id) => graph.getNode(id)?.componentPropertyDefinitions ?? [])
      : []
  const seen = new Set<string>()
  return [...owner.componentPropertyDefinitions, ...variants].filter((definition) => {
    if (seen.has(definition.id)) return false
    seen.add(definition.id)
    return true
  })
}

/**
 * Required values and parts that are unbound, or bound to a property the component no longer
 * has, by value or part id; `states` when the interaction states lost their variant property.
 */
export function missingBindings(
  graph: SceneGraph,
  owner: SceneNode,
  behaviour: Behaviour
): string[] {
  const contract = behaviourContract(behaviour.kind)
  const properties = new Map(
    behaviourProperties(graph, owner).map((definition) => [definition.id, definition])
  )
  const bound = (propertyId: string | undefined, type: ComponentPropertyDefinition['type'][]) => {
    const definition = propertyId ? properties.get(propertyId) : undefined
    return !!definition && type.includes(definition.type)
  }
  const values = contract.values
    .filter((value) => value.required)
    .filter((value) =>
      value.type === 'text'
        ? !bound(textBinding(behaviour, value.id), ['TEXT'])
        : value.type === 'boolean' &&
          !bound(booleanBinding(behaviour, value.id)?.propertyId, ['VARIANT', 'BOOLEAN'])
    )
    .map((value) => value.id)
  const parts = contract.parts
    .filter((part) => part.required && !bound(partBinding(behaviour, part.id), ['SLOT']))
    .map((part) => part.id)
  const states =
    behaviour.states && !bound(behaviour.states.propertyId, ['VARIANT']) ? ['states'] : []
  return [...values, ...parts, ...states]
}

/** Variant value names that usually mean each interaction state, compared case-insensitively. */
const STATE_NAMES: Record<InteractionState, readonly string[]> = {
  rest: ['default', 'rest', 'idle', 'normal', 'enabled'],
  hover: ['hover', 'hovered', 'hovering'],
  pressed: ['pressed', 'active', 'down', 'pressing'],
  focus: ['focus', 'focused', 'focus visible', 'focus-visible'],
  disabled: ['disabled', 'inactive']
}

/**
 * Interaction states for a variant property, each mapped to the value whose name means it, such
 * as `Hover` or `Pressed`; states without such a value are left unset.
 */
export function guessInteractionStates(
  propertyId: string,
  values: readonly string[]
): BehaviourInteractionStates {
  const states: BehaviourInteractionStates = { propertyId }
  for (const state of INTERACTION_STATES) {
    const match = values.find((value) => STATE_NAMES[state].includes(value.trim().toLowerCase()))
    if (match) states[state] = match
  }
  return states
}

/**
 * The behaviour with every component property id it binds renamed by `rename`, for formats that
 * give properties new ids on write, such as `.fig` with its GUIDs.
 */
export function renameBehaviourProperties(
  behaviour: Behaviour,
  rename: (propertyId: string) => string
): Behaviour {
  const mapValues = <T>(record: Record<string, T>, change: (value: T) => T) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, change(value)]))
  return {
    ...behaviour,
    booleans: mapValues(behaviour.booleans, (binding) => ({
      ...binding,
      propertyId: rename(binding.propertyId)
    })),
    texts: mapValues(behaviour.texts, (binding) => ({ propertyId: rename(binding.propertyId) })),
    parts: mapValues(behaviour.parts, rename),
    ...(behaviour.states
      ? { states: { ...behaviour.states, propertyId: rename(behaviour.states.propertyId) } }
      : {})
  }
}
