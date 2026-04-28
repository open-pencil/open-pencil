import type { EditorContext } from '#core/editor/types'

export function createSelectionReadActions(ctx: EditorContext) {
  function getSelectedNodes() {
    const nodes = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (node) nodes.push({ ...node })
    }
    return nodes
  }

  function getSelectedNode() {
    if (ctx.state.selectedIds.size !== 1) return undefined
    const id = ctx.state.selectedIds.values().next().value as string
    const node = ctx.graph.getNode(id)
    return node ? { ...node } : undefined
  }

  function getLayerTree() {
    return ctx.graph.flattenTree(ctx.state.currentPageId)
  }

  return { getSelectedNodes, getSelectedNode, getLayerTree }
}
