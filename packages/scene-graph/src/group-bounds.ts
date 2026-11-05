import { getAxisAlignedBoundsInParent, getNodeLocalMatrix } from './coordinate'
import type { SceneGraph } from './graph'
import Matrix from './matrix'
import { FITTED_CONTAINER_TYPES } from './node-defaults'
import type { Rect, Vector } from './primitives'
import type { SceneNode } from './types'

/** Where a layer sits, with a connector's ends, since a free end is in the parent's axes too. */
type Placement = Pick<SceneNode, 'x' | 'y' | 'width' | 'height'> &
  Partial<Pick<SceneNode, 'connectorStart' | 'connectorEnd'>>

/** What `fitEnclosingGroups` changed, so a caller can undo and redo it. */
export interface GroupFit {
  before: Map<string, Placement>
  after: Map<string, Placement>
  /** Emptied groups, outermost last, with their index in their parent. */
  removed: Array<{ node: SceneNode; index: number }>
}

export interface GroupFitOptions {
  /**
   * The box of a boolean operation's result in its parent's space, which Figma sizes a boolean to,
   * or null to fit its operands. Measuring needs path operations, so the renderer supplies it.
   */
  booleanBounds?: (node: SceneNode) => Rect | null
}

function placement(node: SceneNode): Placement {
  const box = { x: node.x, y: node.y, width: node.width, height: node.height }
  if (node.type !== 'CONNECTOR') return box
  return {
    ...box,
    connectorStart: structuredClone(node.connectorStart),
    connectorEnd: structuredClone(node.connectorEnd)
  }
}

/** A connector end moved by `dx`, `dy` when it is free, as its point is in the parent's axes. */
function shiftedEnd(
  end: SceneNode['connectorStart'],
  dx: number,
  dy: number
): SceneNode['connectorStart'] {
  if (end?.nodeId !== null) return end
  return { ...end, position: { x: end.position.x - dx, y: end.position.y - dy } }
}

/** Groups and booleans holding the parents, innermost first. */
function fittedAncestors(graph: SceneGraph, parentIds: Iterable<string>): SceneNode[] {
  const found = new Map<string, { node: SceneNode; depth: number }>()
  for (const parentId of parentIds) {
    const chain: SceneNode[] = []
    for (let node = graph.getNode(parentId); node && FITTED_CONTAINER_TYPES.has(node.type);) {
      chain.push(node)
      node = node.parentId ? graph.getNode(node.parentId) : undefined
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

/**
 * The layers a group's box covers, bottom to top. Hidden layers do not count, as in Figma. A mask
 * hides the layers above it outside its shape, so they count only through the mask: the box is
 * the layers below it and the masks.
 */
function groupBoundingLayers(children: readonly SceneNode[]): SceneNode[] {
  const shown = children.filter((child) => child.visible)
  const firstMask = shown.findIndex((child) => child.isMask)
  if (firstMask === -1) return shown
  return [...shown.slice(0, firstMask), ...shown.slice(firstMask).filter((c) => c.isMask)]
}

/**
 * A group's box in its parent's space: around the layers it shows, or, with every layer hidden,
 * empty at `origin`, where Figma leaves it.
 */
export function groupBounds(
  graph: SceneGraph,
  children: readonly SceneNode[],
  parentId: string,
  origin: Vector
): Rect {
  const layers = groupBoundingLayers(children)
  return layers.length > 0
    ? getAxisAlignedBoundsInParent(layers, parentId, graph)
    : { x: origin.x, y: origin.y, width: 0, height: 0 }
}

/** A child moved back by the group's shift, a connector's free ends with it. */
function shiftedBack(child: SceneNode, dx: number, dy: number): Partial<SceneNode> {
  const moved = { x: child.x - dx, y: child.y - dy }
  if (child.type !== 'CONNECTOR') return moved
  return {
    ...moved,
    connectorStart: shiftedEnd(child.connectorStart, dx, dy),
    connectorEnd: shiftedEnd(child.connectorEnd, dx, dy)
  }
}

function isTransformed(node: SceneNode): boolean {
  return node.rotation !== 0 || node.flipX || node.flipY
}

/**
 * The group's new box in its parent's space and how far its children shift in its own frame, so
 * that the group holds its children while they stay put on the canvas. An unrotated group takes
 * their bounds in its parent's space. A rotated or flipped group keeps its angle: it takes their
 * bounds in its own frame, and its position is solved so its frame still maps every child to the
 * same canvas point, as its rotation and flips are unchanged. A rotated or flipped boolean, whose
 * box comes from its result's path, keeps its bounds.
 */
function fittedBox(
  graph: SceneGraph,
  group: SceneNode,
  parentId: string,
  children: SceneNode[],
  options: GroupFitOptions
): { box: Rect; shift: Vector } | null {
  if (!isTransformed(group)) {
    const box =
      (group.type === 'BOOLEAN_OPERATION' ? options.booleanBounds?.(group) : null) ??
      groupBounds(graph, children, parentId, group)
    return { box, shift: { x: box.x - group.x, y: box.y - group.y } }
  }
  if (group.type === 'BOOLEAN_OPERATION') return null
  const local = groupBounds(graph, children, group.id, { x: 0, y: 0 })
  const [px, py] = Matrix.mapPoints(getNodeLocalMatrix(group), [local.x, local.y])
  const sized = { ...group, width: local.width, height: local.height }
  const [qx, qy] = Matrix.mapPoints(getNodeLocalMatrix(sized, { x: 0, y: 0 }), [0, 0])
  return {
    box: { x: px - qx, y: py - qy, width: local.width, height: local.height },
    shift: { x: local.x, y: local.y }
  }
}

const FIT_TOLERANCE = 1e-9

function unchanged(value: number, previous: number): boolean {
  return Math.abs(value - previous) <= FIT_TOLERANCE * Math.max(1, Math.abs(previous))
}

/** Moves the group to its children's bounds, shifting them back so they stay put. */
function fitGroup(
  graph: SceneGraph,
  group: SceneNode,
  children: SceneNode[],
  fit: GroupFit,
  options: GroupFitOptions
) {
  if (!group.parentId) return
  const fitted = fittedBox(graph, group, group.parentId, children, options)
  if (!fitted) return
  const { box, shift } = fitted
  // A rotated group's frame leaves rounding residue; a fit within it changes nothing.
  if (
    unchanged(shift.x, 0) &&
    unchanged(shift.y, 0) &&
    unchanged(box.width, group.width) &&
    unchanged(box.height, group.height)
  ) {
    return
  }
  for (const node of [group, ...children]) {
    if (!fit.before.has(node.id)) fit.before.set(node.id, placement(node))
  }
  graph.updateNode(group.id, box)
  for (const child of children) {
    graph.updateNode(child.id, shiftedBack(child, shift.x, shift.y))
  }
  for (const node of [group, ...children]) {
    const current = graph.getNode(node.id)
    if (current) fit.after.set(node.id, placement(current))
  }
}

/** A group left without layers goes away; an empty boolean stays, as in Figma. */
function removeEmptyGroup(graph: SceneGraph, group: SceneNode, fit: GroupFit) {
  if (group.type !== 'GROUP' || !group.parentId) return
  const index = graph.getNode(group.parentId)?.childIds.indexOf(group.id) ?? -1
  fit.removed.push({ node: structuredClone(group), index })
  graph.deleteNode(group.id)
}

/**
 * Refits the groups and booleans around these parents to their children, keeping every child where
 * it is on the canvas, and removes groups left empty, as Figma does after a layer inside one moves,
 * resizes, or leaves. Rotated or flipped groups keep their angle; a rotated or flipped boolean keeps
 * its bounds. Returns null when nothing changed.
 */
export function fitEnclosingGroups(
  graph: SceneGraph,
  parentIds: Iterable<string>,
  options: GroupFitOptions = {}
): GroupFit | null {
  const fit: GroupFit = { before: new Map(), after: new Map(), removed: [] }
  for (const group of fittedAncestors(graph, parentIds)) {
    const children = graph.getChildren(group.id)
    if (children.length === 0) removeEmptyGroup(graph, group, fit)
    else fitGroup(graph, group, children, fit, options)
  }
  return fit.before.size === 0 && fit.removed.length === 0 ? null : fit
}

/** Reapplies a fit after `undoGroupFit`. */
export function redoGroupFit(graph: SceneGraph, fit: GroupFit): void {
  for (const [id, value] of fit.after) graph.updateNode(id, value)
  for (const { node } of fit.removed) graph.deleteNode(node.id)
}

/** Brings back the groups a fit removed and their earlier bounds. */
export function undoGroupFit(graph: SceneGraph, fit: GroupFit): void {
  // Outer groups were removed after inner ones, so they come back first.
  for (const { node, index } of fit.removed.toReversed()) {
    const parentId = node.parentId ?? graph.rootId
    graph.createNode(node.type, parentId, { ...structuredClone(node), childIds: [] })
    if (index >= 0) graph.insertChildAt(node.id, parentId, index)
  }
  for (const [id, value] of fit.before) graph.updateNode(id, value)
}
