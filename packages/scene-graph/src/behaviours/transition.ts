import type { SceneGraph } from '../graph'
import { easingPreset } from '../variables/easing'
import {
  mapMotionVariables,
  motionVariableIds,
  resolveMotion,
  type ResolvedMotion
} from '../variables/motion'
import type { Behaviour, BehaviourTransition } from './schema'

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
