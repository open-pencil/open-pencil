import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import { prepareSlotEdits } from '#core/editor/components/slots'
import type { EditorContext } from '#core/editor/types'

export type WrapContainerType =
  | 'GROUP'
  | 'FRAME'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'BOOLEAN_OPERATION'

const CONTAINER_NAMES: Record<WrapContainerType, string> = {
  BOOLEAN_OPERATION: 'Boolean',
  COMPONENT_SET: 'Component Set',
  COMPONENT: 'Component',
  GROUP: 'Group',
  FRAME: 'Frame'
}

/**
 * The parent these layers share when a new container may go there, or null when they are not
 * siblings or sit in the locked part of an instance.
 */
export function wrapParentId(ctx: EditorContext, nodes: readonly SceneNode[]): string | null {
  const first = nodes.at(0)
  if (!first) return null
  const parentId = first.parentId ?? ctx.state.currentPageId
  if (nodes.some((node) => (node.parentId ?? ctx.state.currentPageId) !== parentId)) return null
  return prepareSlotEdits(ctx, [parentId]) ? parentId : null
}

/**
 * Wraps sibling layers in a new container that spans them, keeping them where they are on the
 * canvas. The container goes to `index` among the parent's remaining children, or on top when
 * `index` is omitted. The editor's wrap commands and the plugin API's `group`, boolean
 * operations, and `createComponentFromNode` all wrap through here; `props` gives the look.
 */
export function wrapNodes(
  graph: SceneGraph,
  type: WrapContainerType,
  nodes: readonly SceneNode[],
  parentId: string,
  index: number | undefined,
  props: Partial<SceneNode> = {}
): SceneNode {
  const bounds = getAxisAlignedBoundsInParent(nodes, parentId, graph)
  const container = graph.createNode(type, parentId, {
    name: CONTAINER_NAMES[type],
    ...bounds,
    fills: [],
    ...props
  })
  for (const node of inStackOrder(graph, nodes, parentId)) {
    graph.reparentNode(node.id, container.id)
  }
  if (index !== undefined) graph.insertChildAt(container.id, parentId, index)
  return container
}

/** Sibling layers bottom to top, whatever order they were selected in. */
export function inStackOrder(
  graph: SceneGraph,
  nodes: readonly SceneNode[],
  parentId: string
): SceneNode[] {
  const order = graph.getNode(parentId)?.childIds ?? []
  return nodes.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

/**
 * Where Figma's canvas commands put a container made from `nodes`: in the topmost one's place,
 * counted among the children left once they move into it.
 */
export function canvasWrapIndex(parent: SceneNode, nodes: readonly SceneNode[]): number {
  return Math.max(...nodes.map((node) => parent.childIds.indexOf(node.id))) - (nodes.length - 1)
}

export function wrapSelectionInContainer(
  ctx: EditorContext,
  containerType: WrapContainerType,
  selectedNodes: SceneNode[],
  extraProps?: Partial<SceneNode>
) {
  const parentId = wrapParentId(ctx, selectedNodes)
  const parent = parentId ? ctx.graph.getNode(parentId) : undefined
  if (!parentId || !parent) return null

  const prevSelection = new Set(ctx.state.selectedIds)
  const origPositions = selectedNodes
    .map((n) => ({ id: n.id, x: n.x, y: n.y, index: parent.childIds.indexOf(n.id) }))
    .toSorted((a, b) => a.index - b.index)
  const index = canvasWrapIndex(parent, selectedNodes)

  const containerNode = wrapNodes(
    ctx.graph,
    containerType,
    selectedNodes,
    parentId,
    index,
    extraProps
  )
  const containerId = containerNode.id
  ctx.setSelectedIds(new Set([containerId]))

  ctx.undo.push({
    label: `Create ${containerType.toLowerCase().replace('_', ' ')}`,
    forward: () => {
      const nodes = origPositions.flatMap((n) => ctx.graph.getNode(n.id) ?? [])
      wrapNodes(ctx.graph, containerType, nodes, parentId, index, {
        ...containerNode,
        childIds: [],
        id: containerId
      })
      ctx.setSelectedIds(new Set([containerId]))
    },
    inverse: () => {
      for (const orig of origPositions) {
        ctx.graph.reparentNode(orig.id, parentId)
        ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
      }
      ctx.graph.deleteNode(containerId)
      // Back to their own places in the stack, lowest first so each index is still free.
      for (const orig of origPositions) ctx.graph.insertChildAt(orig.id, parentId, orig.index)
      ctx.setSelectedIds(prevSelection)
    }
  })

  return containerId
}
