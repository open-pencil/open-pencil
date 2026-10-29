import { clamp } from 'es-toolkit'

import type { ArcData, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/**
 * On-canvas arc handles, as Figma desktop draws and drags them on a selected ellipse. Angles run
 * clockwise from three o'clock in the ellipse's own space, scaled to a unit circle, so a handle
 * dragged to the bounding box's corner of a wide ellipse sits at 45°.
 */
export const ARC_HANDLE = {
  /** The shortest on-screen side, in pixels, at which an ellipse shows its handles. */
  minShapeSize: 75,
  /** How far inside a whole ellipse's edge its one handle sits, in screen pixels. */
  edgeInset: 10,
  /** Shift rounds angles to this step, in radians. */
  angleStep: Math.PI / 12,
  /** Shift rounds the ratio to this step. */
  ratioStep: 0.1
} as const

/** An arc's start, its end (whose label shows the sweep), and its inner ratio. */
export type ArcHandleKind = 'arcStart' | 'arcEnd' | 'arcRatio'

const FULL_TURN = 2 * Math.PI
/** How close to a full turn a sweep draws and edits as a whole ellipse: 0.01°. */
const WHOLE_TOLERANCE = (0.01 * Math.PI) / 180

/** The arc an ellipse is drawn with, a whole one when it has none. */
export function arcOf(node: SceneNode): ArcData {
  return node.arcData ?? { startingAngle: 0, endingAngle: FULL_TURN, innerRadius: 0 }
}

/** Whether an arc sweeps a whole turn, so it is drawn and edited as a whole ellipse or ring. */
export function isWholeArc(arc: ArcData): boolean {
  return Math.abs(arc.endingAngle - arc.startingAngle) >= FULL_TURN - WHOLE_TOLERANCE
}

/** The node-local point at an angle, a share of the way from the centre to the edge. */
function onEllipse(node: SceneNode, angle: number, share: number): Vector {
  const rx = node.width / 2
  const ry = node.height / 2
  return { x: rx + rx * share * Math.cos(angle), y: ry + ry * share * Math.sin(angle) }
}

/** The point a fixed number of node pixels inside the edge, towards the centre. */
function insideEdge(node: SceneNode, angle: number, inset: number): Vector {
  const edge = onEllipse(node, angle, 1)
  const dx = edge.x - node.width / 2
  const dy = edge.y - node.height / 2
  const length = Math.hypot(dx, dy)
  if (length === 0) return edge
  const share = Math.max(length - inset, 0) / length
  return { x: node.width / 2 + dx * share, y: node.height / 2 + dy * share }
}

/**
 * Where the handles sit, in node-local pixels. A whole ellipse has one end handle at its start, a
 * little inside the edge, or halfway across its ring when it has a hole, where the ratio handle
 * sits opposite on the inner edge. An arc's start and end handles sit halfway across their edges
 * and its ratio handle on the inner edge at the middle of the sweep, at the centre without a hole.
 * The end comes first so that it wins where the two meet and a closed arc can be opened again.
 */
export function arcHandles(
  node: SceneNode,
  zoom: number
): Array<{ handle: ArcHandleKind; local: Vector }> {
  const arc = arcOf(node)
  const { startingAngle: start, endingAngle: end, innerRadius: inner } = arc
  const middle = (1 + inner) / 2
  const ratio = { handle: 'arcRatio' as const, local: onEllipse(node, (start + end) / 2, inner) }
  if (isWholeArc(arc)) {
    if (inner === 0)
      return [{ handle: 'arcEnd', local: insideEdge(node, start, ARC_HANDLE.edgeInset / zoom) }]
    return [{ handle: 'arcEnd', local: onEllipse(node, start, middle) }, ratio]
  }
  return [
    { handle: 'arcEnd', local: onEllipse(node, end, middle) },
    { handle: 'arcStart', local: onEllipse(node, start, middle) },
    ratio
  ]
}

/** A node-local point relative to the shape's centre, with its ellipse scaled to a unit circle. */
export function unitOffset(node: SceneNode, local: Vector): Vector {
  return {
    x: (local.x - node.width / 2) / (node.width / 2),
    y: (local.y - node.height / 2) / (node.height / 2)
  }
}

function snapped(value: number, step: number, snap: boolean): number {
  return snap ? Math.round(value / step) * step : value
}

function angleAt(node: SceneNode, local: Vector, snap: boolean): number {
  const { x, y } = unitOffset(node, local)
  return snapped(Math.atan2(y, x), ARC_HANDLE.angleStep, snap)
}

/**
 * The arc a handle dragged to a node-local point gives, as in Figma. The start turns the whole
 * arc and is kept within one turn. The end follows the pointer without jumping, and a sweep that
 * passes a full turn continues from the other side, so the ellipse loses the slice the handle
 * crosses. The ratio is the pointer's distance from the centre in any direction. Shift rounds
 * angles to 15° and the ratio to tenths.
 */
export function arcAtPoint(
  node: SceneNode,
  handle: ArcHandleKind,
  local: Vector,
  snap: boolean
): ArcData {
  const arc = arcOf(node)
  const { startingAngle: start, endingAngle: end } = arc
  if (handle === 'arcRatio') {
    const { x, y } = unitOffset(node, local)
    const ratio = clamp(snapped(Math.hypot(x, y), ARC_HANDLE.ratioStep, snap), 0, 1)
    return { ...arc, innerRadius: ratio }
  }
  const angle = angleAt(node, local, snap)
  if (handle === 'arcStart') {
    const turned = ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN
    return { ...arc, startingAngle: turned, endingAngle: turned + end - start }
  }
  let next = angle + Math.round((end - angle) / FULL_TURN) * FULL_TURN
  if (next - start > FULL_TURN) next -= 2 * FULL_TURN
  else if (next - start < -FULL_TURN) next += 2 * FULL_TURN
  return { ...arc, endingAngle: next }
}

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10 || 0)
}

/** What a handle's label shows: the start in degrees, or the sweep or ratio in percent. */
export function arcHandleValue(node: SceneNode, handle: ArcHandleKind): string {
  const { startingAngle: start, endingAngle: end, innerRadius } = arcOf(node)
  if (handle === 'arcStart') return `${oneDecimal((start * 180) / Math.PI)}°`
  if (handle === 'arcEnd') return `${oneDecimal(((end - start) / FULL_TURN) * 100)}%`
  return `${oneDecimal(innerRadius * 100)}%`
}

/**
 * The fields a handle dragged to a node-local point sets. The outline a `.fig` stored for the old
 * arc is dropped so that the ellipse is drawn from the new one.
 */
export function arcChanges(
  node: SceneNode,
  handle: ArcHandleKind,
  local: Vector,
  snap: boolean
): Partial<SceneNode> {
  return { arcData: arcAtPoint(node, handle, local, snap), fillGeometry: [], strokeGeometry: [] }
}
