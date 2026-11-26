import { compact } from 'es-toolkit/array'

import type { SceneGraph } from '../graph'
import type { Easing, Variable } from '../types'
import { isEasing } from './easing'

/**
 * A duration in seconds and an easing, each its own value or, while the variable exists, a TIMING
 * or EASING variable's, as Figma keeps a transition's duration and easing beside the variables
 * they follow.
 */
export interface Motion {
  duration: number
  easing: Easing
  durationVariableId?: string
  easingVariableId?: string
}

/** What a motion plays: its duration and easing, with variables read. */
export interface ResolvedMotion {
  duration: number
  easing: Easing
}

/** A live variable of `type` by its ID, or undefined when it is gone or holds something else. */
export function liveVariable(
  graph: SceneGraph,
  id: string | undefined,
  type: Variable['type']
): Variable | undefined {
  const variable = id ? graph.variables.get(id) : undefined
  return variable && !variable.deleted && variable.type === type ? variable : undefined
}

/** A TIMING variable's value for `nodeId`, or `fallback` when there is none to read. */
export function resolveTiming(
  graph: SceneGraph,
  variableId: string | undefined,
  nodeId: string,
  fallback: number
): number {
  const timing = liveVariable(graph, variableId, 'TIMING')
  const value = timing && graph.resolveVariableForNode(nodeId, timing.id)
  return typeof value === 'number' && value >= 0 ? value : fallback
}

/**
 * The motion `nodeId` plays: each variable read in the modes the node is in, and the motion's own
 * value where the variable is gone or gives nothing.
 */
export function resolveMotion(graph: SceneGraph, motion: Motion, nodeId: string): ResolvedMotion {
  const easing = liveVariable(graph, motion.easingVariableId, 'EASING')
  const curve = easing && graph.resolveVariableForNode(nodeId, easing.id)
  return {
    duration: resolveTiming(graph, motion.durationVariableId, nodeId, motion.duration),
    easing: isEasing(curve) ? curve : motion.easing
  }
}

/** The variables a motion follows. */
export function motionVariableIds(motion: Motion): string[] {
  return compact([motion.durationVariableId, motion.easingVariableId])
}

/**
 * The motion following other variables, as a copy into another document or a file's own IDs name
 * them; a variable `map` gives nothing for is let go, keeping the value.
 */
export function mapMotionVariables<T extends Motion>(
  motion: T,
  map: (variableId: string) => string | undefined
): T {
  const { durationVariableId, easingVariableId, ...values } = motion
  const mapped = structuredClone(values) as T
  const duration = durationVariableId === undefined ? undefined : map(durationVariableId)
  const easing = easingVariableId === undefined ? undefined : map(easingVariableId)
  if (duration !== undefined) mapped.durationVariableId = duration
  if (easing !== undefined) mapped.easingVariableId = easing
  return mapped
}
