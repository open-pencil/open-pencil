import { computeAbsoluteBounds } from '#core/geometry'

import type { SceneNode } from '#core/scene-graph'
import type { EditorContext } from '#core/editor/types'

export function wrapSelectionInContainer(
  ctx: EditorContext,
  isTopLevel: (parentId: string | null) => boolean,
  containerType: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
  selectedNodes: SceneNode[],
  extraProps?: Partial<SceneNode>
) {
  if (selectedNodes.length === 0) return null

  const parentId = selectedNodes[0].parentId ?? ctx.state.currentPageId
  const sameParent = selectedNodes.every(
    (n) => (n.parentId ?? ctx.state.currentPageId) === parentId
  )
  if (!sameParent) return null

  const parent = ctx.graph.getNode(parentId)
  if (!parent) return null

  const prevSelection = new Set(ctx.state.selectedIds)
  const nodeIds = selectedNodes.map((n) => n.id)
  const origPositions = selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

  const {
    x: minX,
    y: minY,
    width: bw,
    height: bh
  } = computeAbsoluteBounds(selectedNodes, (id) => ctx.graph.getAbsolutePosition(id))
  const maxX = minX + bw
  const maxY = minY + bh

  const parentAbs = isTopLevel(parentId)
    ? { x: 0, y: 0 }
    : ctx.graph.getAbsolutePosition(parentId)
  const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

  const padding = containerType === 'COMPONENT_SET' ? 40 : 0
  const containerNames: Record<string, string> = {
    COMPONENT_SET: selectedNodes[0].name.split('/')[0]?.trim() || 'Component Set',
    COMPONENT: 'Component',
    GROUP: 'Group',
    FRAME: 'Frame'
  }
  const containerNode = ctx.graph.createNode(containerType, parentId, {
    name: containerNames[containerType] ?? containerType,
    x: minX - parentAbs.x - padding,
    y: minY - parentAbs.y - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    fills:
      containerType === 'COMPONENT_SET'
        ? [
            {
              type: 'SOLID',
              color: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        : [],
    ...extraProps
  })
  const containerId = containerNode.id

  ctx.graph.insertChildAt(containerId, parentId, firstIndex)

  for (const n of selectedNodes) {
    ctx.graph.reparentNode(n.id, containerId)
  }

  ctx.state.selectedIds = new Set([containerId])

  ctx.undo.push({
    label: `Create ${containerType.toLowerCase().replace('_', ' ')}`,
    forward: () => {
      const c = ctx.graph.createNode(containerType, parentId, {
        ...containerNode,
        ...extraProps,
        id: containerId
      })
      ctx.graph.insertChildAt(c.id, parentId, firstIndex)
      for (const n of origPositions) ctx.graph.reparentNode(n.id, c.id)
      ctx.state.selectedIds = new Set([c.id])
    },
    inverse: () => {
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, parentId)
        ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
      }
      ctx.graph.deleteNode(containerId)
      ctx.state.selectedIds = prevSelection
    }
  })

  return containerId
}
