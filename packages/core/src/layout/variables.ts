import { reconcileNumericVariableBindings, type SceneGraph } from '@open-pencil/scene-graph'

import { computeLayout } from '#core/layout'

import { createLayoutRunner } from './mutations'

/** Binding evaluation is derived work, not an additional history entry. */
export function reconcileVariableLayouts(graph: SceneGraph): void {
  const { runLayoutForNode } = createLayoutRunner(() => graph)
  for (const id of reconcileNumericVariableBindings(graph)) {
    // A deliberate binding change also invalidates a placed instance's saved Hug size.
    computeLayout(graph, id)
    runLayoutForNode(id)
  }
}
