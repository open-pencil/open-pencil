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

/** The parent all these layers share, or null when they are not siblings. */
export function sharedParentId(ctx: EditorContext, nodes: readonly SceneNode[]): string | null {
  const first = nodes.at(0)
  if (!first) return null
  const parentId = first.parentId ?? ctx.state.currentPageId
  return nodes.every((node) => (node.parentId ?? ctx.state.currentPageId) === parentId)
    ? parentId
    : null
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
  for (const node of nodes) graph.reparentNode(node.id, container.id)
  if (index !== undefined) graph.insertChildAt(container.id, parentId, index)
  return container
}

/** Index a container made from `nodes` takes: where the lowest of them sat. */
function lowestIndex(parent: SceneNode, nodes: readonly SceneNode[]): number {
  return Math.min(...nodes.map((node) => parent.childIds.indexOf(node.id)))
}

export function wrapSelectionInContainer(
  ctx: EditorContext,
  containerType: WrapContainerType,
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
  const origPositions = selectedNodes
    .map((n) => ({ id: n.id, x: n.x, y: n.y, index: parent.childIds.indexOf(n.id) }))
    .toSorted((a, b) => a.index - b.index)
  const index = lowestIndex(parent, selectedNodes)

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
