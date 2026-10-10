import type { SceneNode, Vector } from '@open-pencil/scene-graph'

import type { SceneGeometry } from './scene'
import type { ViewportTransform } from './types'

/**
 * On-canvas corner radius handles, as Figma desktop draws and drags them on a selected rectangle.
 * Each handle sits at the centre of its corner's arc, kept a little inside small corners, and
 * dragging one sets the radius whose arc centre is under the pointer.
 */
export const CORNER_RADIUS_HANDLE = {
  /** The shortest on-screen side, in pixels, at which a rectangle shows its handles. */
  minShapeSize: 108,
  /** The closest a handle comes to its corner along each edge, in screen pixels. */
  minInset: 12.5,
  /** The dot that marks a drag of one corner only. */
  dotRadius: 1,
  /** How far from its centre a handle, drawn the size of a resize handle, takes the pointer. */
  hitRadius: 7,
  /** Shift rounds radii to this step. */
  snapStep: 10,
  /** Where the radius label sits relative to the pointer: its left edge and vertical centre. */
  labelOffset: { x: 10, y: -20 }
} as const

export type RadiusCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'

export const RADIUS_CORNERS: readonly RadiusCorner[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft'
]

/** The direction from each corner into the rectangle, along both edges. */
const INWARD: Record<RadiusCorner, Vector> = {
  topLeft: { x: 1, y: 1 },
  topRight: { x: -1, y: 1 },
  bottomRight: { x: -1, y: -1 },
  bottomLeft: { x: 1, y: -1 }
}

export interface CornerRadiusHandle {
  corner: RadiusCorner
  /** The handle's centre in screen coordinates. */
  point: Vector
}

/** Figma shows radius handles on rectangles only; frames, ellipses, and vectors have none. */
export function hasCornerRadiusHandles(node: SceneNode): boolean {
  return node.type === 'RECTANGLE'
}

export function cornerRadii(node: SceneNode): Record<RadiusCorner, number> {
  if (!node.independentCorners) {
    const radius = node.cornerRadius
    return { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius }
  }
  return {
    topLeft: node.topLeftRadius,
    topRight: node.topRightRadius,
    bottomRight: node.bottomRightRadius,
    bottomLeft: node.bottomLeftRadius
  }
}

/**
 * Whether a drag changes only the corner it holds. Corners that differ are dragged one at a time
 * and equal ones all together; Alt reverses either, as in Figma.
 */
export function dragsSingleCorner(node: SceneNode, altKey: boolean): boolean {
  const radii = Object.values(cornerRadii(node))
  return radii.some((radius) => radius !== radii[0]) !== altKey
}

function maxRadius(node: SceneNode): number {
  return Math.min(node.width, node.height) / 2
}

function cornerPoint(node: SceneNode, corner: RadiusCorner): Vector {
  return {
    x: corner === 'topLeft' || corner === 'bottomLeft' ? 0 : node.width,
    y: corner === 'topLeft' || corner === 'topRight' ? 0 : node.height
  }
}

/** The rectangle's handles on screen, or null when it is too small on screen to show them. */
export function cornerRadiusHandleLayout(
  node: SceneNode,
  geometry: SceneGeometry,
  viewport: ViewportTransform
): CornerRadiusHandle[] | null {
  if (!hasCornerRadiusHandles(node)) return null
  if (Math.min(node.width, node.height) * viewport.zoom < CORNER_RADIUS_HANDLE.minShapeSize)
    return null
  const radii = cornerRadii(node)
  const minInset = CORNER_RADIUS_HANDLE.minInset / viewport.zoom
  return RADIUS_CORNERS.map((corner) => {
    const origin = cornerPoint(node, corner)
    const inset = Math.max(Math.min(radii[corner], maxRadius(node)), minInset)
    const local = {
      x: origin.x + INWARD[corner].x * inset,
      y: origin.y + INWARD[corner].y * inset
    }
    return { corner, point: geometry.toScreen(node, local, viewport) }
  })
}

export function hitTestCornerRadiusHandles(
  handles: readonly CornerRadiusHandle[],
  screen: Vector
): RadiusCorner | null {
  const hit = handles.find(
    (handle) =>
      Math.hypot(screen.x - handle.point.x, screen.y - handle.point.y) <=
      CORNER_RADIUS_HANDLE.hitRadius
  )
  return hit?.corner ?? null
}

/**
 * The radius whose arc centre lies under a node-local point: its distance from the corner along
 * the diagonal, in whole pixels, or in steps of 10 with Shift.
 */
export function cornerRadiusAtPoint(
  node: SceneNode,
  corner: RadiusCorner,
  local: Vector,
  snap: boolean
): number {
  const origin = cornerPoint(node, corner)
  const inward = INWARD[corner]
  const distance = ((local.x - origin.x) * inward.x + (local.y - origin.y) * inward.y) / 2
  const step = snap ? CORNER_RADIUS_HANDLE.snapStep : 1
  return Math.min(Math.max(Math.round(distance / step) * step, 0), maxRadius(node))
}

/** The fields that set one corner, or all four, to a radius. */
export function cornerRadiusChanges(
  node: SceneNode,
  corner: RadiusCorner,
  radius: number,
  single: boolean
): Partial<SceneNode> {
  if (!single) {
    return {
      cornerRadius: radius,
      independentCorners: false,
      topLeftRadius: radius,
      topRightRadius: radius,
      bottomRightRadius: radius,
      bottomLeftRadius: radius
    }
  }
  const radii = { ...cornerRadii(node), [corner]: radius }
  return {
    independentCorners: true,
    topLeftRadius: radii.topLeft,
    topRightRadius: radii.topRight,
    bottomRightRadius: radii.bottomRight,
    bottomLeftRadius: radii.bottomLeft
  }
}
