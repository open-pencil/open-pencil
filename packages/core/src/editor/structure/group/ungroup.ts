import { compact, uniq } from 'es-toolkit'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { acceptsChildren, prepareSlotEdits } from '#core/editor/components/slots'
import { recordEdit } from '#core/editor/history/edit'
import { refitContainers } from '#core/editor/structure/group/bounds'
import type { EditorContext } from '#core/editor/types'

/** The layers Figma's Ungroup takes apart; components and instances stay whole. */
const UNGROUPABLE_TYPES: ReadonlySet<NodeType> = new Set([
  'GROUP',
  'FRAME',
  'BOOLEAN_OPERATION',
  'SECTION'
])

/**
 * Moves a container's children into its parent, in the container's place in the stack and where
 * they are on the canvas, and deletes the container with its own look. A child placed absolutely
 * in an auto layout joins the flow of wherever it lands. Returns the children, or null when the
 * container has no parent. Shared by the editor's Ungroup command and the plugin API's `ungroup`.
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
    if (graph.getNode(id)?.layoutPositioning === 'ABSOLUTE') {
      graph.updateNode(id, { layoutPositioning: 'AUTO' })
    }
  })
  graph.deleteNode(node.id)
  return childIds
}

/**
 * Whether Ungroup takes this layer apart, as Figma's does: a group, frame, boolean, or section,
 * outside the locked part of an instance.
 */
export function canUngroupNode(ctx: Pick<EditorContext, 'graph'>, node: SceneNode): boolean {
  return (
    UNGROUPABLE_TYPES.has(node.type) &&
    node.parentId !== null &&
    acceptsChildren(ctx, node.parentId) &&
    acceptsChildren(ctx, node.id)
  )
}

/**
 * Ungroups every selected layer Ungroup takes apart, as one undo step, and selects their children
 * along with the other selected layers, as Figma does. Returns the children, or an empty list
 * when nothing was ungrouped.
 */
export function ungroupSelected(ctx: EditorContext, selectedNodes: SceneNode[]): string[] {
  const containers = selectedNodes.filter((node) => canUngroupNode(ctx, node))
  if (containers.length === 0) return []
  const parentIds = uniq(compact(containers.map((node) => node.parentId)))
  const kept = selectedNodes.filter((node) => !containers.includes(node)).map((node) => node.id)

  // Claiming an instance slot's content is part of the same undo step.
  return ctx.undo.runBatch('Ungroup', () => {
    if (!prepareSlotEdits(ctx, [...parentIds, ...containers.map((node) => node.id)])) return []
    return recordEdit(ctx, { label: 'Ungroup', restoresSelection: true }, () => {
      const freed = containers.flatMap((node) => ungroupNode(ctx.graph, node.id) ?? [])
      // A group around the ungrouped layer spans its children now; an auto layout places them.
      refitContainers(ctx, parentIds)
      for (const parentId of parentIds) {
        if (ctx.graph.getNode(parentId)?.layoutMode !== 'NONE') ctx.runLayoutForNode(parentId)
      }
      ctx.setSelectedIds(new Set([...freed, ...kept]))
      return freed
    })
  })
}
