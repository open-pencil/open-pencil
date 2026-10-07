import {
  reconcileVariableBindings,
  type BindingScope,
  type SceneGraph
} from '@open-pencil/scene-graph'

import { computeLayout } from '#core/layout'

import { createLayoutRunner } from './mutations'

/**
 * Binding evaluation is derived work, not an additional history entry. The scope names what
 * changed, so only the layers that change can reach are resolved and laid out again.
 */
export function reconcileVariableLayouts(graph: SceneGraph, scope: BindingScope): void {
  const { runLayoutForNode } = createLayoutRunner(() => graph)
  for (const id of reconcileVariableBindings(graph, scope)) {
    // A deliberate binding change also invalidates a placed instance's saved Hug size.
    computeLayout(graph, id)
    runLayoutForNode(id)
  }
}
