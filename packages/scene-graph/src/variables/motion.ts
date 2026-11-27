import { compact } from 'es-toolkit/array'

import { parseCSSEasing } from '../css/motion'
import type { SceneGraph } from '../graph'
import { EASING_CURVES, type Easing, type EasingCurve, type Variable } from '../types'
import { easingPreset, isEasing } from './easing'
import type { MotionSpec } from './schema'

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
  // A deleted variable the document keeps still resolves for the bindings it had.
  return variable?.type === type ? variable : undefined
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
 * `base` with what a spec sets: values as given, and variables, which keep their value in their
 * collection's default mode beside them, for when they are gone.
 */
export function motionFromSpec<T extends Motion>(graph: SceneGraph, spec: MotionSpec, base: T): T {
  const motion = structuredClone(base)
  if (typeof spec.duration === 'number') {
    motion.duration = spec.duration
    delete motion.durationVariableId
  } else if (spec.duration) {
    const variable = namedVariable(graph, spec.duration.variable, 'TIMING')
    const value = graph.resolveVariable(variable.id)
    motion.durationVariableId = variable.id
    if (typeof value === 'number') motion.duration = value
  }
  if (typeof spec.easing === 'string') {
    motion.easing = easingOfSpec(spec.easing)
    delete motion.easingVariableId
  } else if (spec.easing && 'variable' in spec.easing) {
    const variable = namedVariable(graph, spec.easing.variable, 'EASING')
    const value = graph.resolveVariable(variable.id)
    motion.easingVariableId = variable.id
    if (isEasing(value)) motion.easing = value
  } else if (spec.easing) {
    motion.easing = structuredClone(spec.easing)
    delete motion.easingVariableId
  }
  return motion
}

/** How a spec names a variable: by its name, or by its ID where another live variable shares it. */
function specReference(graph: SceneGraph, variable: Variable): { variable: string } {
  const named = graph.getLiveVariables().filter((item) => item.name === variable.name)
  return { variable: named.length === 1 ? variable.name : variable.id }
}

/** A motion as a spec reads it: variables by name, while they exist, else values. */
export function motionToSpec(graph: SceneGraph, motion: Motion): Required<MotionSpec> {
  const timing = liveVariable(graph, motion.durationVariableId, 'TIMING')
  const easing = liveVariable(graph, motion.easingVariableId, 'EASING')
  return {
    duration: timing ? specReference(graph, timing) : motion.duration,
    easing: easing ? specReference(graph, easing) : structuredClone(motion.easing)
  }
}
