import { parseCSSEasing } from '../css/motion'
import type { SceneGraph } from '../graph'
import { EASING_CURVES, type Easing, type EasingCurve, type Variable } from '../types'
import { easingPreset, isEasing } from '../variables/easing'
import {
  liveVariable,
  mapMotionVariables,
  motionVariableIds,
  resolveMotion,
  type ResolvedMotion
} from '../variables/motion'
import type { Behaviour, BehaviourSpec, BehaviourTransition } from './schema'

type TransitionSpec = NonNullable<BehaviourSpec['transition']>

/** What a control's state change plays: a duration in seconds and an easing. */
export type ResolvedTransition = ResolvedMotion

/** The transition a behaviour starts with when one is added: Figma's Smart animate default. */
export function defaultTransition(): BehaviourTransition {
  return { duration: 0.3, easing: easingPreset('OUT_CUBIC') }
}

/**
 * The transition `node` plays, an instance of the behaviour's component: each variable read in the
 * modes the node is in, and the behaviour's own value where the variable is gone or gives nothing.
 */
export function resolveTransition(
  graph: SceneGraph,
  behaviour: Behaviour,
  nodeId: string
): ResolvedTransition | undefined {
  return behaviour.transition && resolveMotion(graph, behaviour.transition, nodeId)
}

/** The variables a behaviour's transition follows. */
export function transitionVariableIds(behaviour: Behaviour): string[] {
  return behaviour.transition ? motionVariableIds(behaviour.transition) : []
}

/**
 * The behaviour with its transition following other variables, as a copy into another document
 * or a file's own IDs name them; a variable `map` gives nothing for is let go, keeping the value.
 */
export function mapTransitionVariables(
  behaviour: Behaviour,
  map: (variableId: string) => string | undefined
): Behaviour {
  if (!behaviour.transition) return behaviour
  return { ...behaviour, transition: mapMotionVariables(behaviour.transition, map) }
}

/** A live variable of `type`, by its ID or its name; a spec names one either way. */
function namedVariable(graph: SceneGraph, name: string, type: Variable['type']): Variable {
  const variable =
    graph.variables.get(name) ?? graph.getLiveVariables().find((item) => item.name === name)
  if (!variable || variable.deleted) throw new Error(`No variable named "${name}"`)
  if (variable.type !== type)
    throw new Error(`"${variable.name}" holds ${variable.type}; this needs a ${type} variable`)
  return variable
}

function isEasingCurve(name: string): name is EasingCurve {
  return (EASING_CURVES as readonly string[]).includes(name)
}

function easingOfSpec(easing: string): Easing {
  if (isEasingCurve(easing)) return easingPreset(easing)
  const parsed = parseCSSEasing(easing)
  if (!parsed)
    throw new Error(`"${easing}" is not an easing: use a CSS easing or a name such as OUT_CUBIC`)
  return parsed
}

/**
 * A spec's transition as stored. A value left out is the default's; a variable keeps its value in
 * its collection's default mode beside it, for when it is gone.
 */
export function transitionFromSpec(graph: SceneGraph, spec: TransitionSpec): BehaviourTransition {
  const transition = defaultTransition()
  if (typeof spec.duration === 'number') transition.duration = spec.duration
  else if (spec.duration) {
    const variable = namedVariable(graph, spec.duration.variable, 'TIMING')
    const value = graph.resolveVariable(variable.id)
    transition.durationVariableId = variable.id
    if (typeof value === 'number') transition.duration = value
  }
  if (typeof spec.easing === 'string') transition.easing = easingOfSpec(spec.easing)
  else if (spec.easing && 'variable' in spec.easing) {
    const variable = namedVariable(graph, spec.easing.variable, 'EASING')
    const value = graph.resolveVariable(variable.id)
    transition.easingVariableId = variable.id
    if (isEasing(value)) transition.easing = value
  } else if (spec.easing) transition.easing = structuredClone(spec.easing)
  return transition
}

/** A stored transition as a spec reads it: variables by name, while they exist, else values. */
export function transitionToSpec(
  graph: SceneGraph,
  transition: BehaviourTransition
): TransitionSpec {
  const timing = liveVariable(graph, transition.durationVariableId, 'TIMING')
  const easing = liveVariable(graph, transition.easingVariableId, 'EASING')
  return {
    duration: timing ? { variable: timing.name } : transition.duration,
    easing: easing ? { variable: easing.name } : structuredClone(transition.easing)
  }
}
