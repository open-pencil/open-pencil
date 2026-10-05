import type { NodeType, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'

import type { EditorContext } from '#core/editor/types'

/** Containers whose bounds follow their children, as in Figma. */
const FITTED_TYPES = new Set<NodeType>(['GROUP', 'BOOLEAN_OPERATION'])

type Placement = Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>

function placement(node: SceneNode): Placement {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

/** Groups and booleans holding the parents, innermost first. */
function fittedAncestors(ctx: EditorContext, parentIds: Iterable<string>): SceneNode[] {
  const found = new Map<string, { node: SceneNode; depth: number }>()
  for (const parentId of parentIds) {
    const chain: SceneNode[] = []
    for (let node = ctx.graph.getNode(parentId); node && FITTED_TYPES.has(node.type);) {
      chain.push(node)
      node = ctx.graph.getNode(node.parentId ?? '')
    }
    for (const [index, node] of chain.entries()) {
      found.set(node.id, {
        node,
        depth: Math.max(found.get(node.id)?.depth ?? 0, chain.length - index)
      })
    }
  }
  return [...found.values()].sort((a, b) => b.depth - a.depth).map(({ node }) => node)
}

interface FitRecord {
  before: Map<string, Placement>
  after: Map<string, Placement>
  removed: Array<{ node: SceneNode; index: number }>
}

/** Moves the group to its children's bounds, shifting them back so they stay put. */
function fitGroup(ctx: EditorContext, group: SceneNode, children: SceneNode[], record: FitRecord) {
  if (!group.parentId || group.rotation !== 0 || group.flipX || group.flipY) return
  const bounds = getAxisAlignedBoundsInParent(children, group.parentId, ctx.graph)
  const dx = bounds.x - group.x
  const dy = bounds.y - group.y
  if (dx === 0 && dy === 0 && bounds.width === group.width && bounds.height === group.height) {
    return
  }
  for (const node of [group, ...children]) {
    if (!record.before.has(node.id)) record.before.set(node.id, placement(node))
  }
  ctx.graph.updateNode(group.id, bounds)
  for (const child of children) {
    ctx.graph.updateNode(child.id, { x: child.x - dx, y: child.y - dy })
  }
  for (const node of [group, ...children]) {
    const current = ctx.graph.getNode(node.id)
    if (current) record.after.set(node.id, placement(current))
  }
}

/** A group left without layers goes away; an empty boolean stays, as in Figma. */
function removeEmptyGroup(ctx: EditorContext, group: SceneNode, record: FitRecord) {
  if (group.type !== 'GROUP' || !group.parentId) return
  const index = ctx.graph.getNode(group.parentId)?.childIds.indexOf(group.id) ?? -1
  record.removed.push({ node: structuredClone(group), index })
  ctx.graph.deleteNode(group.id)
}

/**
 * Refits the groups and booleans around these parents to their children after a move, keeping
 * every child where it is on the canvas. Rotated or flipped containers keep their bounds.
 */
export function fitEnclosingGroups(ctx: EditorContext, parentIds: Iterable<string>) {
  const record: FitRecord = { before: new Map(), after: new Map(), removed: [] }
  for (const group of fittedAncestors(ctx, parentIds)) {
    const children = ctx.graph.getChildren(group.id)
    if (children.length === 0) removeEmptyGroup(ctx, group, record)
    else fitGroup(ctx, group, children, record)
  }

  const { before, after, removed } = record
  if (before.size === 0 && removed.length === 0) return
  const apply = (placements: Map<string, Placement>) => {
    for (const [id, value] of placements) ctx.graph.updateNode(id, value)
  }
  ctx.undo.push({
    label: 'Fit groups',
    forward: () => {
      apply(after)
      for (const { node } of removed) ctx.graph.deleteNode(node.id)
    },
    inverse: () => {
      // Outer groups were removed after inner ones, so they come back first.
      for (const { node, index } of removed.toReversed()) {
        const parentId = node.parentId ?? ctx.state.currentPageId
        ctx.graph.createNode(node.type, parentId, { ...structuredClone(node), childIds: [] })
        if (index >= 0) ctx.graph.insertChildAt(node.id, parentId, index)
      }
      apply(before)
    }
  })
}
