import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts, computeLayout } from '#core/layout'

export function createLayoutRunner(getGraph: () => SceneGraph) {
  function runLayoutForNode(id: string) {
    const graph = getGraph()
    const node = graph.getNode(id)
    if (!node) return

    computeAllLayouts(graph, id)

    let parent = node.parentId ? graph.getNode(node.parentId) : undefined
    while (parent) {
      if (parent.layoutMode !== 'NONE') {
        computeLayout(graph, parent.id)
      }
      parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
    }
  }

  return { runLayoutForNode }
}
