import {
  behaviourProperties,
  readBehaviour,
  type BehaviourKind,
  type ComponentPropertyDefinition,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { behaviourArgs, type BehaviourArgs, type BooleanArg } from '../args'
import type { StateCondition } from './types'

/** The `data-state` value a boolean prop sets when on, as Reka and Radix set it. */
const DATA_STATE_ON: Partial<Record<string, string>> = {
  checked: 'checked',
  pressed: 'on',
  open: 'open'
}

const INTERACTIONS = ['hover', 'pressed', 'focus'] as const

/** Controls whose focus lands on a layer inside them: a slider's thumb, a field's input. */
const FOCUS_WITHIN = new Set<BehaviourKind>(['slider', 'textField', 'textarea', 'numberField'])

/** The condition a variant property's value adds, or `null` for its rest value. */
type ValueCondition = (value: string) => StateCondition | null

function booleanCondition(arg: BooleanArg): ValueCondition {
  return (value) => {
    if (value === arg.off) return null
    if (arg.name === 'disabled') return { type: 'disabled' }
    const state = DATA_STATE_ON[arg.name]
    return state ? { type: 'state', value: state } : { type: 'prop', name: arg.name, value }
  }
}

/** The interaction-state property's values: hover, pressed, focus, and disabled. */
function interactionCondition(set: SceneNode, states: NonNullable<BehaviourArgs['states']>) {
  const behaviour = readBehaviour(set)
  const within = behaviour ? FOCUS_WITHIN.has(behaviour.kind) : false
  const byValue = new Map<string, StateCondition>()
  for (const state of INTERACTIONS) {
    const value = behaviour?.states?.[state]
    if (value !== undefined && value !== states.rest)
      byValue.set(value, {
        type: 'interaction',
        state,
        ...(state === 'focus' && within ? { within } : {})
      })
  }
  if (states.disabled !== undefined) byValue.set(states.disabled, { type: 'disabled' })
  const name = states.property
  return (value: string): StateCondition | null => {
    if (value === states.rest) return null
    // A value the behaviour does not map to a state still shows its variant, as a prop.
    return byValue.get(value) ?? { type: 'prop', name, value }
  }
}

/** Any other variant property is a prop the generated component sets as `data-*`. */
function propCondition(definition: ComponentPropertyDefinition): ValueCondition {
  return (value) =>
    value === definition.defaultValue ? null : { type: 'prop', name: definition.name, value }
}

/**
 * Reads the conditions that show each variant of a set: from its behaviour's boolean props and
 * interaction states, and every other variant property as a prop. `null` for a variant that
 * leaves a property out, which can't be placed among the others.
 */
export function variantConditions(
  graph: SceneGraph,
  set: SceneNode
): (variant: SceneNode) => StateCondition[] | null {
  const args = behaviourArgs(graph, set)
  const conditionOf = (definition: ComponentPropertyDefinition): ValueCondition => {
    const boolean = args?.booleans.get(definition.name)
    if (boolean) return booleanCondition(boolean)
    if (args?.states?.property === definition.name) return interactionCondition(set, args.states)
    const filled = args?.filled
    if (filled?.property === definition.name)
      return (value) => (value === filled.on ? { type: 'filled' } : null)
    return propCondition(definition)
  }
  const byProperty = new Map(
    behaviourProperties(graph, set)
      .filter((definition) => definition.type === 'VARIANT')
      .map((definition) => [definition.name, conditionOf(definition)] as const)
  )
  return (variant) => {
    const conditions: StateCondition[] = []
    for (const [property, condition] of byProperty) {
      if (!Object.hasOwn(variant.componentPropertyValues, property)) return null
      const added = condition(variant.componentPropertyValues[property])
      if (added) conditions.push(added)
    }
    return conditions
  }
}
