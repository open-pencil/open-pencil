import type { EditorContext } from '#core/editor/types'
import type { SceneNode } from '#core/scene-graph'

export function topLevelSelectedNodes(selectedNodes: SceneNode[]): SceneNode[] {
  const selectedSet = new Set(selectedNodes.map((node) => node.id))
  return selectedNodes.filter((node) => !node.parentId || !selectedSet.has(node.parentId))
}

export function selectedNodesInSharedParent(ctx: EditorContext, selectedNodes: SceneNode[]) {
  const topLevel = topLevelSelectedNodes(selectedNodes)
  if (topLevel.length === 0 || topLevel.some((node) => node.locked)) return null

  const parentId = topLevel[0].parentId ?? ctx.state.currentPageId
  if (!topLevel.every((node) => (node.parentId ?? ctx.state.currentPageId) === parentId))
    return null

  const parent = ctx.graph.getNode(parentId)
  return parent ? { topLevel, parentId, parent } : null
}
