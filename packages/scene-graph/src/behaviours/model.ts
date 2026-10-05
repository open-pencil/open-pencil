import type { SceneGraph } from '../index'
import { readPluginData, withPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { ComponentPropertyDefinition, SceneNode } from '../types'
import { behaviourContract, type BehaviourKind } from './kinds'
import type { Behaviour, BehaviourBooleanBinding, BehaviourNumberSettings } from './schema'

export type { Behaviour, BehaviourBooleanBinding, BehaviourNumberSettings } from './schema'

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
  return { kind, booleans: {}, numbers, parts: {} }
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
 * has, by value or part id.
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
    .filter((value) => value.type === 'boolean' && value.required)
    .filter((value) => !bound(behaviour.booleans[value.id]?.propertyId, ['VARIANT', 'BOOLEAN']))
    .map((value) => value.id)
  const parts = contract.parts
    .filter((part) => part.required && !bound(behaviour.parts[part.id], ['SLOT']))
    .map((part) => part.id)
  return [...values, ...parts]
}
