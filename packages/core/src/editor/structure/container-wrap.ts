import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import { prepareSlotEdits } from '#core/editor/components/slots'
import type { EditorContext } from '#core/editor/types'

/** The parent all these layers share, or null when they are not siblings. */
export function sharedParentId(ctx: EditorContext, nodes: readonly SceneNode[]): string | null {
  const first = nodes.at(0)
  if (!first) return null
  const parentId = first.parentId ?? ctx.state.currentPageId
  return nodes.every((node) => (node.parentId ?? ctx.state.currentPageId) === parentId)
    ? parentId
    : null
}

export function wrapSelectionInContainer(
  ctx: EditorContext,
  containerType: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
  selectedNodes: SceneNode[],
  extraProps?: Partial<SceneNode>
) {
  const parentId = sharedParentId(ctx, selectedNodes)
  if (!parentId) return null

  const parent = ctx.graph.getNode(parentId)
  if (!parent) return null
  // The locked part of an instance takes no new containers.
  if (!prepareSlotEdits(ctx, [parentId])) return null

  const prevSelection = new Set(ctx.state.selectedIds)
  const nodeIds = selectedNodes.map((n) => n.id)
  const origPositions = selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

  const bounds = getAxisAlignedBoundsInParent(selectedNodes, parentId, ctx.graph)
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
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
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

  ctx.setSelectedIds(new Set([containerId]))

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
      ctx.setSelectedIds(new Set([c.id]))
    },
    inverse: () => {
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, parentId)
        ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
      }
      ctx.graph.deleteNode(containerId)
      ctx.setSelectedIds(prevSelection)
    }
  })

  return containerId
}
