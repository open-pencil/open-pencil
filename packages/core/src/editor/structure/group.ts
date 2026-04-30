import type { SceneNode } from '#core/scene-graph'
import type { EditorContext } from '#core/editor/types'

export function ungroupSelected(ctx: EditorContext, selectedNode: SceneNode | undefined) {
  if (selectedNode?.type !== 'GROUP') return

  const node = selectedNode
  const parentId = node.parentId ?? ctx.state.currentPageId
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return

  const groupIndex = parent.childIds.indexOf(node.id)
  const childIds = [...node.childIds]
  const prevSelection = new Set(ctx.state.selectedIds)
  const origPositions = childIds.map((id) => {
    const child = ctx.graph.getNode(id)
    if (!child) return { id, x: 0, y: 0 }
    return { id, x: child.x, y: child.y }
  })
  const groupId = node.id
  const groupSnapshot = { ...node, childIds: [...node.childIds] }

  for (let i = 0; i < childIds.length; i++) {
    ctx.graph.reparentNode(childIds[i], parentId)
    ctx.graph.insertChildAt(childIds[i], parentId, groupIndex + i)
  }

  ctx.graph.deleteNode(node.id)
  ctx.state.selectedIds = new Set(childIds)

  ctx.undo.push({
    label: 'Ungroup',
    forward: () => {
      for (let i = 0; i < childIds.length; i++) {
        ctx.graph.reparentNode(childIds[i], parentId)
        ctx.graph.insertChildAt(childIds[i], parentId, groupIndex + i)
      }
      ctx.graph.deleteNode(groupId)
      ctx.state.selectedIds = new Set(childIds)
    },
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
      ctx.state.selectedIds = prevSelection
    }
  })
}
