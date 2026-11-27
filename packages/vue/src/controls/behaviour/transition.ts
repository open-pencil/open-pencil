import type { SceneGraph } from '@open-pencil/scene-graph'
import { defaultTransition, type Behaviour } from '@open-pencil/scene-graph/behaviours'

import {
  bindMotion,
  motionControl,
  setMotion,
  type MotionControl,
  type MotionPatch
} from '#vue/controls/motion'

/** The behaviour's transition as the panel shows it, with the variables it can follow. */
export function behaviourTransitionControl(
  graph: SceneGraph,
  behaviour: Behaviour
): MotionControl | null {
  return behaviour.transition ? motionControl(graph, behaviour.transition) : null
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
    setTransition: (patch: MotionPatch) =>
      update((current) =>
        current.transition
          ? { ...current, transition: setMotion(current.transition, patch) }
          : current
      ),
    /**
     * Make the duration or easing follow a variable, or let go of it with null. Its value in its
     * default mode becomes the transition's own, for when the variable is gone.
     */
    bindTransition: (field: 'duration' | 'easing', variableId: string | null) =>
      update((current) =>
        current.transition
          ? { ...current, transition: bindMotion(graph, current.transition, field, variableId) }
          : current
      )
  }
}
