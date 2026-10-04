import * as v from 'valibot'

import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { getPluginData, OPEN_PENCIL_PLUGIN_DATA_NAMESPACE } from '#core/figma-api/plugin-data'

import { behaviourContract, type BehaviourKind } from './kinds'

/** The plugin-data key a component's behaviour is kept under, in OpenPencil's namespace. */
export const BEHAVIOUR_PLUGIN_DATA_KEY = 'behaviour'

const BooleanBinding = v.object({
  propertyId: v.string(),
  /** For a variant property: the values that mean on and off. */
  on: v.optional(v.string()),
  off: v.optional(v.string())
})

const NumberSettings = v.object({
  min: v.number(),
  max: v.number(),
  step: v.number(),
  default: v.number()
})

const BehaviourSchema = v.object({
  kind: v.picklist(['switch', 'checkbox', 'slider', 'tabs'] satisfies BehaviourKind[]),
  /** Boolean values, by value id, bound to component properties. */
  booleans: v.record(v.string(), BooleanBinding),
  /** Number values, by value id: the range the behaviour keeps itself. */
  numbers: v.record(v.string(), NumberSettings),
  /** Parts, by part id, bound to slot properties. */
  parts: v.record(v.string(), v.string())
})

/** How a main component behaves as a control, as kept in its plugin data. */
export type Behaviour = v.InferOutput<typeof BehaviourSchema>
export type BehaviourBooleanBinding = v.InferOutput<typeof BooleanBinding>
export type BehaviourNumberSettings = v.InferOutput<typeof NumberSettings>

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
    (contract?.values ?? [])
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
  const raw = getPluginData(owner, BEHAVIOUR_PLUGIN_DATA_KEY)
  if (!raw) return null
  try {
    const parsed = v.safeParse(BehaviourSchema, JSON.parse(raw))
    return parsed.success ? parsed.output : null
  } catch {
    return null
  }
}

/** The owner's plugin data with the behaviour set, or removed when null. */
export function withBehaviour(
  owner: SceneNode,
  behaviour: Behaviour | null
): SceneNode['pluginData'] {
  const rest = owner.pluginData.filter(
    (entry) =>
      !(
        entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE &&
        entry.key === BEHAVIOUR_PLUGIN_DATA_KEY
      )
  )
  if (!behaviour) return rest
  return [
    ...rest,
    {
      pluginId: OPEN_PENCIL_PLUGIN_DATA_NAMESPACE,
      key: BEHAVIOUR_PLUGIN_DATA_KEY,
      value: JSON.stringify(behaviour)
    }
  ]
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
  if (!contract) return []
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
