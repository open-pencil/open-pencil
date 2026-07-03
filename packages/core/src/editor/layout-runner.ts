import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts, computeLayout } from '#core/layout'

function isImportedFigInstanceSubtree(graph: SceneGraph, nodeId: string): boolean {
  let node = graph.getNode(nodeId) ?? null
  while (node) {
    if (node.type === 'INSTANCE' && node.source.format === 'fig') return true
    node = node.parentId ? (graph.getNode(node.parentId) ?? null) : null
  }
  return false
}

export function createLayoutRunner(getGraph: () => SceneGraph) {
  function runLayoutForNode(id: string) {
    const graph = getGraph()
    const node = graph.getNode(id)
    if (!node) return

    const reflowImportedInstance = node.type === 'INSTANCE' && node.source.format === 'fig'
    const preserveImportedInstanceLayout = !reflowImportedInstance
    computeAllLayouts(graph, id, { preserveImportedInstanceLayout })

    let parent = node.parentId ? graph.getNode(node.parentId) : undefined
    while (parent) {
      const shouldPreserveParent =
        preserveImportedInstanceLayout && isImportedFigInstanceSubtree(graph, parent.id)
      if (!shouldPreserveParent && parent.layoutMode !== 'NONE') {
        computeLayout(graph, parent.id)
      }
      parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
    }
  }

  return { runLayoutForNode }
}
