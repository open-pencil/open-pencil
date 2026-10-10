import {
  behaviourProperties,
  readBehaviour,
  type Behaviour,
  type BehaviourKind,
  type ComponentPropertyDefinition,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

/** A variant property a boolean value draws, as the component's boolean prop. */
export interface BooleanArg {
  /** The prop's name, as Reka and Radix call it: `checked`, `pressed`, `open`, `disabled`. */
  name: string
  on: string
  off: string
}

/** The props a component with a behaviour has, read from the variant properties that draw it. */
export interface BehaviourArgs {
  /** Boolean props by the name of the variant property that draws them. */
  booleans: Map<string, BooleanArg>
  /**
   * The variant property that draws interaction states. States follow the pointer and focus,
   * so they are not props; `rest` is the value shown without one, and `disabled` the value the
   * disabled prop shows, if the set draws it.
   */
  states?: { property: string; rest: string; disabled?: string }
  /**
   * The variant property that draws a field with text, which the field shows while its input
   * has text rather than taking as a prop.
   */
  filled?: { property: string; on: string; off: string }
}

/** Values a behaviour derives from others instead of taking as props. */
const DERIVED_VALUES = new Set(['filled'])

function booleanArgName(kind: BehaviourKind, valueId: string): string {
  if (valueId !== 'value') return valueId
  return kind === 'toggle' ? 'pressed' : 'checked'
}

/** The variant property a field's `filled` value draws, with its on and off values. */
function filledArg(
  behaviour: Behaviour,
  variant: (id: string) => ComponentPropertyDefinition | undefined
): BehaviourArgs['filled'] {
  const binding = Object.hasOwn(behaviour.booleans, 'filled')
    ? behaviour.booleans.filled
    : undefined
  const definition = binding && variant(binding.propertyId)
  if (!definition || binding.on === undefined || binding.off === undefined) return undefined
  return { property: definition.name, on: binding.on, off: binding.off }
}

/**
 * The props of a component set with a behaviour. Only variant properties become props here,
 * since each variant is drawn; a boolean value becomes a boolean prop when its property offers
 * exactly its on and off values.
 */
export function behaviourArgs(graph: SceneGraph, set: SceneNode): BehaviourArgs | null {
  const behaviour = readBehaviour(set)
  if (!behaviour) return null
  const variants = behaviourProperties(graph, set).filter((item) => item.type === 'VARIANT')
  const variant = (id: string) => variants.find((item) => item.id === id)
  const booleans = new Map<string, BooleanArg>()
  for (const [valueId, binding] of Object.entries(behaviour.booleans)) {
    const definition = variant(binding.propertyId)
    const { on, off } = binding
    if (!definition || on === undefined || off === undefined || DERIVED_VALUES.has(valueId))
      continue
    const options = new Set(definition.variantOptions)
    if (options.size !== 2 || !options.has(on) || !options.has(off)) continue
    booleans.set(definition.name, { name: booleanArgName(behaviour.kind, valueId), on, off })
  }
  const statesProperty = behaviour.states && variant(behaviour.states.propertyId)
  const states = statesProperty
    ? {
        property: statesProperty.name,
        rest: behaviour.states?.rest ?? statesProperty.defaultValue,
        disabled: behaviour.states?.disabled
      }
    : undefined
  const filled = filledArg(behaviour, variant)
  return { booleans, states, ...(filled ? { filled } : {}) }
}
