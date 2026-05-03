import { computeAbsoluteBounds } from '#core/geometry'
import { computeLayout } from '#core/layout'

import type { EditorContext } from '#core/editor/types'
import type { LayoutMode, SceneNode } from '#core/scene-graph'

export function wrapInAutoLayout(
  ctx: EditorContext,
  isTopLevel: (parentId: string | null) => boolean,
  selectedNodes: SceneNode[]
) {
  if (selectedNodes.length === 0) return

  const parentId = selectedNodes[0].parentId ?? ctx.state.currentPageId
  const sameParent = selectedNodes.every(
    (n) => (n.parentId ?? ctx.state.currentPageId) === parentId
  )
  if (!sameParent) return

  const prevSelection = new Set(ctx.state.selectedIds)
  const origPositions = selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, parentId }))

  const bounds = computeAbsoluteBounds(selectedNodes, (id) => ctx.graph.getAbsolutePosition(id))

  const parentAbs = isTopLevel(parentId) ? { x: 0, y: 0 } : ctx.graph.getAbsolutePosition(parentId)

  const direction: LayoutMode =
    selectedNodes.length <= 1 || bounds.height > bounds.width ? 'VERTICAL' : 'HORIZONTAL'

  const frame = ctx.graph.createNode('FRAME', parentId, {
    name: 'Frame',
    x: bounds.x - parentAbs.x,
    y: bounds.y - parentAbs.y,
    width: bounds.width,
    height: bounds.height,
    layoutMode: direction,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN',
    fills: []
  })
  const frameId = frame.id

  const sortedIds = selectedNodes
    .map((n) => ({ id: n.id, pos: ctx.graph.getAbsolutePosition(n.id) }))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .map((n) => n.id)

  for (const id of sortedIds) {
    ctx.graph.reparentNode(id, frameId)
  }

  computeLayout(ctx.graph, frameId)
  ctx.runLayoutForNode(frameId)
  ctx.state.selectedIds = new Set([frameId])

  ctx.undo.push({
    label: 'Wrap in auto layout',
    forward: () => {
      const f = ctx.graph.createNode('FRAME', parentId, { ...frame, id: frameId })
      for (const n of origPositions) ctx.graph.reparentNode(n.id, f.id)
      computeLayout(ctx.graph, f.id)
      ctx.runLayoutForNode(f.id)
      ctx.state.selectedIds = new Set([f.id])
    },
    inverse: () => {
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, orig.parentId)
        ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
      }
      ctx.graph.deleteNode(frameId)
      ctx.state.selectedIds = prevSelection
    }
  })
}
