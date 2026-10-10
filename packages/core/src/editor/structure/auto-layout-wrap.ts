import type { LayoutMode, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { wrapParentId } from '#core/editor/structure/container-wrap'
import type { EditorContext } from '#core/editor/types'
import { computeLayout } from '#core/layout'

/** The place and size of each layer and everything inside it, which the new layout can change. */
function captureGeometry(ctx: EditorContext, nodes: SceneNode[]): Map<string, Rect> {
  const geometry = new Map<string, Rect>()
  const visit = (node: SceneNode) => {
    geometry.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height })
    for (const child of ctx.graph.getChildren(node.id)) visit(child)
  }
  for (const node of nodes) visit(node)
  return geometry
}

/**
 * Wrap sibling layers in a new auto layout frame; returns the frame, or null if they are not
 * siblings. The frame takes the slot of the topmost selected layer, as Figma places a new group,
 * and undo puts every layer back in its old slot, place, and size.
 */
export function wrapInAutoLayout(ctx: EditorContext, selectedNodes: SceneNode[]): string | null {
  const wrapParent = wrapParentId(ctx, selectedNodes)
  const parent = wrapParent ? ctx.graph.getNode(wrapParent) : undefined
  if (!parent) return null
  const parentId = parent.id

  const prevSelection = new Set(ctx.state.selectedIds)
  const order = [...parent.childIds]
  const geometry = captureGeometry(ctx, selectedNodes)
  const bounds = getAxisAlignedBoundsInParent(selectedNodes, parentId, ctx.graph)
  const direction: LayoutMode =
    selectedNodes.length <= 1 || bounds.height > bounds.width ? 'VERTICAL' : 'HORIZONTAL'
  const frameFields: Partial<SceneNode> = {
    name: 'Frame',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    layoutMode: direction,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN',
    fills: []
  }
  // In reading order inside the new frame.
  const sortedIds = selectedNodes
    .map((n) => ({ id: n.id, pos: ctx.graph.getAbsolutePosition(n.id) }))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
    .map((n) => n.id)
  // Just above the topmost selected layer, before the selected layers move into the frame.
  const slot = Math.max(...selectedNodes.map((n) => order.indexOf(n.id))) + 1

  function wrap(frameId?: string): string {
    const frame = ctx.graph.createNode('FRAME', parentId, {
      ...frameFields,
      ...(frameId ? { id: frameId } : {})
    })
    ctx.graph.insertChildAt(frame.id, parentId, slot)
    for (const id of sortedIds) ctx.graph.reparentNode(id, frame.id)
    computeLayout(ctx.graph, frame.id)
    ctx.runLayoutForNode(frame.id)
    ctx.setSelectedIds(new Set([frame.id]))
    return frame.id
  }

  const frameId = wrap()
  ctx.undo.push({
    label: 'Wrap in auto layout',
    forward: () => {
      wrap(frameId)
    },
    inverse: () => {
      for (const id of sortedIds) ctx.graph.reparentNode(id, parentId)
      ctx.graph.deleteNode(frameId)
      order.forEach((id, index) => ctx.graph.reorderChild(id, parentId, index))
      for (const [id, rect] of geometry) ctx.graph.updateNode(id, rect)
      ctx.runLayoutForNode(parentId)
      ctx.setSelectedIds(prevSelection)
    }
  })
  return frameId
}
