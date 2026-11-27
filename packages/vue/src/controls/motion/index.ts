import type { Easing, SceneGraph, Variable, VariableValue } from '@open-pencil/scene-graph'
import { isEasing, type Motion } from '@open-pencil/scene-graph/variables'

/** A variable a duration or easing can follow. */
export interface MotionVariable {
  id: string
  name: string
  collection: string
  /** Its value in its collection's default mode. */
  value: VariableValue | undefined
}

/**
 * A duration in seconds and an easing as a panel shows them: each its own value or a variable's,
 * and the variables each can follow.
 */
export interface MotionControl {
  duration: number
  easing: Easing
  durationVariable: MotionVariable | null
  easingVariable: MotionVariable | null
  timingVariables: MotionVariable[]
  easingVariables: MotionVariable[]
}

function motionVariable(graph: SceneGraph, variable: Variable): MotionVariable {
  return {
    id: variable.id,
    name: variable.name,
    collection: graph.variableCollections.get(variable.collectionId)?.name ?? '',
    value: graph.resolveVariable(variable.id)
  }
}

/** A motion as a panel shows it, with the variables it can follow. */
export function motionControl(graph: SceneGraph, motion: Motion): MotionControl {
  const live = graph.getLiveVariables()
  const of = (type: Variable['type']) =>
    live.filter((variable) => variable.type === type).map((item) => motionVariable(graph, item))
  const bound = (id: string | undefined) => {
    const variable = id ? graph.variables.get(id) : undefined
    return variable ? motionVariable(graph, variable) : null
  }
  return {
    duration: motion.duration,
    easing: motion.easing,
    durationVariable: bound(motion.durationVariableId),
    easingVariable: bound(motion.easingVariableId),
    timingVariables: of('TIMING'),
    easingVariables: of('EASING')
  }
}

/** A change a panel makes to a motion: its own duration or easing, which lets go of the variable. */
export interface MotionPatch {
  duration?: number
  easing?: Easing
}

/** The motion with its own duration or easing set; the field set no longer follows a variable. */
export function setMotion<T extends Motion>(motion: T, patch: MotionPatch): T {
  const next = { ...motion, ...patch }
  if (patch.duration !== undefined) delete next.durationVariableId
  if (patch.easing !== undefined) delete next.easingVariableId
  return next
}

/**
 * The motion with its duration or easing following a variable, or with null letting go of it.
 * The variable's value in its default mode becomes the motion's own, for when it is gone.
 */
export function bindMotion<T extends Motion>(
  graph: SceneGraph,
  motion: T,
  field: 'duration' | 'easing',
  variableId: string | null
): T {
  const next = { ...motion }
  const value = variableId === null ? undefined : graph.resolveVariable(variableId)
  if (field === 'duration') {
    if (variableId === null) delete next.durationVariableId
    else next.durationVariableId = variableId
    if (typeof value === 'number') next.duration = value
  } else {
    if (variableId === null) delete next.easingVariableId
    else next.easingVariableId = variableId
    if (isEasing(value)) next.easing = value
  }
  return next
}
