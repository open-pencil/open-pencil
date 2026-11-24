import { useMutationObserver, usePreferredReducedMotion } from '@vueuse/core'
import { computed, shallowRef, type ComputedRef } from 'vue'

import {
  transitionCSS,
  transitionDeclarations,
  type ControlModel,
  type TransitionCSS
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  findLayerByPath,
  resolveTransition,
  type ResolvedTransition
} from '@open-pencil/scene-graph/behaviours'
import { easingSpring, springBounce } from '@open-pencil/scene-graph/variables'

/**
 * Whether islands play their controls' transitions: not while the system asks for reduced
 * motion, nor while the page sets `data-motion="off"` on its root, as the app does when motion
 * is turned off. A shadow root cannot see that attribute from CSS, so it is watched here.
 */
export function useIslandMotion(): ComputedRef<boolean> {
  const preferred = usePreferredReducedMotion()
  const root = typeof document === 'undefined' ? undefined : document.documentElement
  const off = shallowRef(root?.dataset.motion === 'off')
  useMutationObserver(root, () => (off.value = root?.dataset.motion === 'off'), {
    attributeFilter: ['data-motion']
  })
  return computed(() => preferred.value !== 'reduce' && !off.value)
}

/** Whether this browser takes CSS `linear()`, which a spring's timing function is. */
function hasLinearEasing(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
}

/**
 * A transition as preview plays it. A browser without `linear()` gets a curve near the spring:
 * one that overshoots as far as the spring bounces, or Ease out for one that does not.
 */
function previewCSS(transition: ResolvedTransition): TransitionCSS {
  const css = transitionCSS(transition)
  const spring = easingSpring(transition.easing)
  if (!spring || hasLinearEasing()) return css
  const bounce = springBounce(spring)
  const easing = bounce > 0 ? `cubic-bezier(0.34, ${1 + bounce}, 0.64, 1)` : 'ease-out'
  return { ...css, easing }
}

function allControls(controls: Iterable<ControlModel>): ControlModel[] {
  return [...controls].flatMap((control) => [control, ...allControls(control.items)])
}

/**
 * Each control's transition declarations, by its layer path, read for its instance in the
 * modes it is in.
 */
export function islandTransitions(
  graph: SceneGraph,
  rootId: string,
  controls: Iterable<ControlModel>
): Map<string, Record<string, string>> {
  const transitions = new Map<string, Record<string, string>>()
  for (const control of allControls(controls)) {
    const instance = findLayerByPath(graph, rootId, control.path)
    const transition = instance && resolveTransition(graph, control.behaviour, instance.id)
    if (transition) transitions.set(control.path, transitionDeclarations(previewCSS(transition)))
  }
  return transitions
}

/** The transition a layer at `path` plays: its nearest control's. */
export function layerTransition(
  transitions: ReadonlyMap<string, Record<string, string>>,
  path: string
): Record<string, string> | undefined {
  let best: string | undefined
  for (const controlPath of transitions.keys()) {
    const inside = controlPath === '' || path === controlPath || path.startsWith(`${controlPath}/`)
    if (inside && (best === undefined || controlPath.length > best.length)) best = controlPath
  }
  return best === undefined ? undefined : transitions.get(best)
}
