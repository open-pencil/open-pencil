import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

/**
 * Moves a container's children into its parent, in the container's place in the stack, and
 * deletes the container. Returns the children, or null when the container has no parent. Shared
 * by the editor's Ungroup command and the plugin API's `ungroup`.
 */
export function ungroupNode(graph: SceneGraph, nodeId: string): string[] | null {
  const node = graph.getNode(nodeId)
  const parent = node?.parentId ? graph.getNode(node.parentId) : undefined
  if (!node || !parent) return null
  const index = parent.childIds.indexOf(node.id)
  const childIds = [...node.childIds]
  childIds.forEach((id, i) => {
    graph.reparentNode(id, parent.id)
    graph.insertChildAt(id, parent.id, index + i)
  })
  graph.deleteNode(node.id)
  return childIds
}

export function ungroupSelected(ctx: EditorContext, selectedNode: SceneNode | undefined) {
  if (selectedNode?.type !== 'GROUP') return

  const node = selectedNode
  const parentId = node.parentId ?? ctx.state.currentPageId
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return

  const groupIndex = parent.childIds.indexOf(node.id)
  const prevSelection = new Set(ctx.state.selectedIds)
  const origPositions = node.childIds.map((id) => {
    const child = ctx.graph.getNode(id)
    if (!child) return { id, x: 0, y: 0 }
    return { id, x: child.x, y: child.y }
  })
  const groupId = node.id
  const groupSnapshot = { ...node, childIds: [...node.childIds] }

  const ungroup = () => {
    const childIds = ungroupNode(ctx.graph, groupId)
    if (childIds) ctx.setSelectedIds(new Set(childIds))
  }
  ungroup()

  ctx.undo.push({
    label: 'Ungroup',
    forward: ungroup,
    inverse: () => {
      const g = ctx.graph.createNode('GROUP', parentId, {
        ...groupSnapshot,
        childIds: [],
        id: groupId
      })
      ctx.graph.insertChildAt(g.id, parentId, groupIndex)
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, g.id)
        ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
      }
      ctx.setSelectedIds(prevSelection)
    }
  })
}
