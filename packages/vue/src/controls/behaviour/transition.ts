import type { Easing, SceneGraph, Variable } from '@open-pencil/scene-graph'
import { defaultTransition, type Behaviour } from '@open-pencil/scene-graph/behaviours'
import { isEasing } from '@open-pencil/scene-graph/variables'

import type { BehaviourTransitionControl, BehaviourTransitionVariable } from './types'

function transitionVariable(graph: SceneGraph, variable: Variable): BehaviourTransitionVariable {
  return {
    id: variable.id,
    name: variable.name,
    collection: graph.variableCollections.get(variable.collectionId)?.name ?? '',
    value: graph.resolveVariable(variable.id)
  }
}

/** The behaviour's transition as the panel shows it, with the variables it can follow. */
export function behaviourTransitionControl(
  graph: SceneGraph,
  behaviour: Behaviour
): BehaviourTransitionControl | null {
  const transition = behaviour.transition
  if (!transition) return null
  const live = graph.getLiveVariables()
  const of = (type: Variable['type']) =>
    live.filter((variable) => variable.type === type).map((item) => transitionVariable(graph, item))
  const bound = (id: string | undefined) => {
    const variable = id ? graph.variables.get(id) : undefined
    return variable ? transitionVariable(graph, variable) : null
  }
  return {
    duration: transition.duration,
    easing: transition.easing,
    durationVariable: bound(transition.durationVariableId),
    easingVariable: bound(transition.easingVariableId),
    timingVariables: of('TIMING'),
    easingVariables: of('EASING')
  }
}

/** The panel's transition edits, each one undo step through `update`. */
export function createTransitionActions(
  graph: SceneGraph,
  update: (change: (current: Behaviour) => Behaviour) => void
) {
  return {
    /** Animate state changes, with Figma's Smart animate default: Ease out over 300ms. */
    addTransition: () => update((current) => ({ ...current, transition: defaultTransition() })),
    /** Change state at once again. */
    removeTransition: () => update(({ transition: _transition, ...current }) => current),
    /** Set the transition's own duration or easing, which also lets go of its variable. */
    setTransition: (patch: { duration?: number; easing?: Easing }) =>
      update((current) => {
        if (!current.transition) return current
        const transition = { ...current.transition, ...patch }
        if (patch.duration !== undefined) delete transition.durationVariableId
        if (patch.easing !== undefined) delete transition.easingVariableId
        return { ...current, transition }
      }),
    /**
     * Make the duration or easing follow a variable, or let go of it with null. Its value in its
     * default mode becomes the transition's own, for when the variable is gone.
     */
    bindTransition: (field: 'duration' | 'easing', variableId: string | null) =>
      update((current) => {
        const transition = current.transition && { ...current.transition }
        if (!transition) return current
        const value = variableId === null ? undefined : graph.resolveVariable(variableId)
        if (field === 'duration') {
          if (variableId === null) delete transition.durationVariableId
          else transition.durationVariableId = variableId
          if (typeof value === 'number') transition.duration = value
        } else {
          if (variableId === null) delete transition.easingVariableId
          else transition.easingVariableId = variableId
          if (isEasing(value)) transition.easing = value
        }
        return { ...current, transition }
      })
  }
}
