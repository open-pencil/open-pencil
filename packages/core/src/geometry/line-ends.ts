import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  getParentWorldMatrix,
  getWorldMatrix,
  localTransformFromWorld
} from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { scaleVectorNetworkForResize } from '@open-pencil/scene-graph/resize'

/** Which end of a line a handle drags: its origin or the far end along its length. */
export type LineEnd = 'start' | 'end'

/** Shift holds a dragged line to these steps, as Figma does. */
const SNAP_STEP = Math.PI / 4

/**
 * Whether a layer is a line: one of its sides is zero, as a line's or a straight vector's is.
 * Figma selects such a layer by its two ends rather than a box, and dragging an end aims it.
 */
export function isLineLike(node: Pick<SceneNode, 'width' | 'height'>): boolean {
  return (node.width === 0) !== (node.height === 0)
}

/** A line's two ends in its own frame, start first. */
export function lineEndPoints(node: Pick<SceneNode, 'width' | 'height'>): [Vector, Vector] {
  return node.height === 0
    ? [
        { x: 0, y: 0 },
        { x: node.width, y: 0 }
      ]
    : [
        { x: 0, y: 0 },
        { x: 0, y: node.height }
      ]
}

/** A line's two ends in world space, start first. */
export function lineWorldEnds(graph: SceneGraph, node: SceneNode): [Vector, Vector] {
  const world = getWorldMatrix(node, graph)
  const [start, end] = lineEndPoints(node)
  return [Matrix.mapPoint(world, start), Matrix.mapPoint(world, end)]
}

/** `vector` along the nearest 45° direction, as far as it reaches along it. */
function snapped(vector: Vector): Vector {
  const angle = Math.round(Math.atan2(vector.y, vector.x) / SNAP_STEP) * SNAP_STEP
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  const reach = vector.x * direction.x + vector.y * direction.y
  return { x: direction.x * reach, y: direction.y * reach }
}

/**
 * Where a line's ends land when one is dragged by `delta` in world space, as Figma moves them:
 * the dragged end follows the pointer and the other stays; Shift holds the line to 45° steps
 * and Alt keeps its midpoint, moving the other end opposite.
 */
export function draggedLineEnds(
  ends: readonly [Vector, Vector],
  end: LineEnd,
  delta: Vector,
  modifiers: { shift?: boolean; alt?: boolean } = {}
): [Vector, Vector] {
  const moving = end === 'end' ? 1 : 0
  const fixed = ends[1 - moving]
  const anchor = modifiers.alt
    ? { x: (ends[0].x + ends[1].x) / 2, y: (ends[0].y + ends[1].y) / 2 }
    : fixed
  let reach = {
    x: ends[moving].x + delta.x - anchor.x,
    y: ends[moving].y + delta.y - anchor.y
  }
  if (modifiers.shift) reach = snapped(reach)
  const dragged = { x: anchor.x + reach.x, y: anchor.y + reach.y }
  const other = modifiers.alt ? { x: anchor.x - reach.x, y: anchor.y - reach.y } : fixed
  return moving === 1 ? [other, dragged] : [dragged, other]
}

/**
 * The changes that run `line` from `start` to `end`, given in world space: its length along its
 * own axis, its turn, its position, and a vector's path stretched to the new length. A line
 * keeps its zero side. Null when the ends meet.
 */
export function aimLine(
  graph: SceneGraph,
  line: SceneNode,
  start: Vector,
  end: Vector
): Partial<SceneNode> | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return null
  const alongWidth = line.height === 0
  // The world matrix whose local axis runs from start to end.
  const angle = alongWidth ? Math.atan2(dy, dx) : Math.atan2(-dx, dy)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const world: Mat3 = [cos, -sin, start.x, sin, cos, start.y, 0, 0, 1]
  const size = alongWidth ? { width: length, height: 0 } : { width: 0, height: length }
  const parent = line.parentId ? graph.getNode(line.parentId) : undefined
  const transform = localTransformFromWorld(
    { ...line, ...size },
    world,
    getParentWorldMatrix(parent, graph)
  )
  if (!transform) return null
  const vectorNetwork = scaleVectorNetworkForResize(
    line.vectorNetwork,
    line.width,
    line.height,
    size.width,
    size.height
  )
  return { ...transform, ...size, ...(vectorNetwork && { vectorNetwork }) }
}
