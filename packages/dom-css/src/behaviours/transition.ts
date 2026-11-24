import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { readBehaviour, type ResolvedTransition } from '@open-pencil/scene-graph/behaviours'

import { collectionVariables, variableCSSNames } from '../tokens/names'
import { easingToCSS, timingToCSS } from '../tokens/values'

/** A transition's duration and timing function as CSS, such as a token for either. */
export interface TransitionCSS {
  duration: string
  easing: string
}

/**
 * The declarations that animate a layer's changes, every property a state changes, as Figma's
 * Smart animate eases every property of a matched layer. A layer one state draws and another
 * does not appears and disappears at once.
 */
export function transitionDeclarations(transition: TransitionCSS): Record<string, string> {
  return {
    'transition-property': 'all',
    'transition-duration': transition.duration,
    'transition-timing-function': transition.easing
  }
}

/** A transition's own values as CSS. */
export function transitionCSS(transition: ResolvedTransition): TransitionCSS {
  return { duration: timingToCSS(transition.duration), easing: easingToCSS(transition.easing) }
}

/**
 * A component's transition as exported code writes it: each variable as its token with the
 * behaviour's own value as the fallback, `var(--duration-fast, 300ms)`, so it plays the same
 * whether or not a token stylesheet comes with it.
 */
export function behaviourTransitionCSS(
  graph: SceneGraph,
  owner: SceneNode
): TransitionCSS | undefined {
  const transition = readBehaviour(owner)?.transition
  if (!transition) return undefined
  const own = transitionCSS(transition)
  const names = variableCSSNames(collectionVariables(graph))
  const token = (id: string | undefined, fallback: string) => {
    const name = id && graph.variables.has(id) ? names.get(id) : undefined
    return name ? `var(--${name}, ${fallback})` : fallback
  }
  return {
    duration: token(transition.durationVariableId, own.duration),
    easing: token(transition.easingVariableId, own.easing)
  }
}
