import { clamp } from 'es-toolkit'

import type { SceneNode, Vector } from '@open-pencil/scene-graph'
import { POINT_COUNT_RANGE, polygonCorners } from '@open-pencil/scene-graph/polygon'

import type { SceneGeometry } from './scene'
import type { ViewportTransform } from './types'

/**
 * On-canvas shape handles, as Figma desktop draws and drags them on a selected rectangle, polygon,
 * or star. A radius handle sits at the centre of its corner's arc, kept a little inside small
 * corners, and dragging one sets the radius whose arc centre is under the pointer. A polygon's or
 * star's next outer point sets its point count, and a star's first inner point its inner ratio.
 */
export const SHAPE_HANDLE = {
  /** The shortest on-screen side, in pixels, at which a shape shows its handles. */
  minShapeSize: 108,
  /** The closest a handle comes to its corner along each edge, in screen pixels. */
  minInset: 12.5,
  /** The dot that marks a drag of one corner only. */
  dotRadius: 1,
  /** How far from its centre a handle, drawn the size of a resize handle, takes the pointer. */
  hitRadius: 7,
  /** Shift rounds radii to this step. */
  snapStep: 10,
  /** Where a handle's label sits relative to the pointer: its left edge and vertical centre. */
  labelOffset: { x: 10, y: -20 }
} as const

/** A rectangle's four corners, or the top point of a polygon or star. */
export type RadiusCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'point'

const RECTANGLE_CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

type RectangleCorner = (typeof RECTANGLE_CORNERS)[number]

/** A radius handle, or a polygon's or star's point count or a star's inner ratio. */
export type ShapeHandleKind = RadiusCorner | 'count' | 'ratio'

export interface ShapeHandle {
  handle: ShapeHandleKind
  /** The handle's centre in screen coordinates. */
  point: Vector
}

/** A corner as its handle sees it, in the layer's own pixels. */
interface RadiusCornerShape {
  corner: RadiusCorner
  vertex: Vector
  /** The unit direction from the vertex along the corner's bisector, into the shape. */
  inward: Vector
  /** cos(α/2) for a corner turning by α: the arc's centre is radius / factor from the vertex. */
  factor: number
  /** The radius the corner is drawn with. */
  radius: number
  /** The largest radius the corner can be drawn with. */
  max: number
}

/**
 * Figma shows radius handles on rectangles, polygons, and stars; a polygon or star has one, at its
 * top point, since its corners share one radius. Frames, ellipses, and vectors have none.
 */
export function hasShapeHandles(node: SceneNode): boolean {
  return node.type === 'RECTANGLE' || node.type === 'POLYGON' || node.type === 'STAR'
}

export function cornerRadii(node: SceneNode): Record<RectangleCorner, number> {
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

/** The radius a handle's label shows. */
export function cornerRadiusOf(node: SceneNode, corner: RadiusCorner): number {
  return corner === 'point' ? node.cornerRadius : cornerRadii(node)[corner]
}

/**
 * Whether a drag changes only the corner it holds. Corners that differ are dragged one at a time
 * and equal ones all together; Alt reverses either, as in Figma. A polygon's corners always move
 * together.
 */
export function dragsSingleCorner(node: SceneNode, altKey: boolean): boolean {
  if (node.type !== 'RECTANGLE') return false
  const radii = Object.values(cornerRadii(node))
  return radii.some((radius) => radius !== radii[0]) !== altKey
}

const HALF_DIAGONAL = Math.SQRT1_2

function rectangleCorners(node: SceneNode): RadiusCornerShape[] {
  const max = Math.min(node.width, node.height) / 2
  const radii = cornerRadii(node)
  return RECTANGLE_CORNERS.map((corner) => {
    const left = corner === 'topLeft' || corner === 'bottomLeft'
    const top = corner === 'topLeft' || corner === 'topRight'
    return {
      corner,
      vertex: { x: left ? 0 : node.width, y: top ? 0 : node.height },
      inward: { x: (left ? 1 : -1) * HALF_DIAGONAL, y: (top ? 1 : -1) * HALF_DIAGONAL },
      factor: HALF_DIAGONAL,
      radius: Math.min(radii[corner], max),
      max
    }
  })
}

function polygonPoint(node: SceneNode): RadiusCornerShape[] {
  const [top] = polygonCorners(node)
  const [widest] = polygonCorners({ ...node, cornerRadius: Number.POSITIVE_INFINITY })
  const bisector = { x: top.outgoing.x - top.incoming.x, y: top.outgoing.y - top.incoming.y }
  const length = Math.hypot(bisector.x, bisector.y)
  return [
    {
      corner: 'point',
      vertex: top.vertex,
      inward: { x: bisector.x / length, y: bisector.y / length },
      factor: Math.cos(top.turn / 2),
      radius: top.radius,
      max: widest.radius
    }
  ]
}

function radiusCorners(node: SceneNode): RadiusCornerShape[] {
  return node.type === 'RECTANGLE' ? rectangleCorners(node) : polygonPoint(node)
}

/**
 * Where a polygon's count handle and a star's ratio handle sit: on the next outer point and the
 * first inner point, or at the middle of their rounding.
 */
function pointHandles(node: SceneNode): Array<{ handle: 'count' | 'ratio'; local: Vector }> {
  if (node.type !== 'POLYGON' && node.type !== 'STAR') return []
  const corners = polygonCorners(node)
  const onOutline = (index: number) => {
    const { vertex, incoming, outgoing, turn, radius } = corners[index]
    const bisector = { x: outgoing.x - incoming.x, y: outgoing.y - incoming.y }
    const length = Math.hypot(bisector.x, bisector.y)
    const inset = length > 0 ? radius / Math.cos(turn / 2) - radius : 0
    return {
      x: vertex.x + (length > 0 ? (bisector.x / length) * inset : 0),
      y: vertex.y + (length > 0 ? (bisector.y / length) * inset : 0)
    }
  }
  if (node.type === 'POLYGON') return [{ handle: 'count', local: onOutline(1) }]
  return [
    { handle: 'ratio', local: onOutline(1) },
    { handle: 'count', local: onOutline(2) }
  ]
}

/** The shape's handles on screen, or null when it is too small on screen to show them. */
export function shapeHandleLayout(
  node: SceneNode,
  geometry: SceneGeometry,
  viewport: ViewportTransform
): ShapeHandle[] | null {
  if (!hasShapeHandles(node)) return null
  if (Math.min(node.width, node.height) * viewport.zoom < SHAPE_HANDLE.minShapeSize) return null
  const minDistance = SHAPE_HANDLE.minInset / HALF_DIAGONAL / viewport.zoom
  const radii = radiusCorners(node).map(({ corner, vertex, inward, factor, radius }) => {
    const distance = Math.max(radius / factor, minDistance)
    const local = { x: vertex.x + inward.x * distance, y: vertex.y + inward.y * distance }
    return { handle: corner, point: geometry.toScreen(node, local, viewport) }
  })
  const points = pointHandles(node).map(({ handle, local }) => ({
    handle,
    point: geometry.toScreen(node, local, viewport)
  }))
  return [...radii, ...points]
}

export function hitTestShapeHandles(
  handles: readonly ShapeHandle[],
  screen: Vector
): ShapeHandleKind | null {
  const hit = handles.find(
    (handle) =>
      Math.hypot(screen.x - handle.point.x, screen.y - handle.point.y) <= SHAPE_HANDLE.hitRadius
  )
  return hit?.handle ?? null
}

export function isRadiusHandle(handle: ShapeHandleKind): handle is RadiusCorner {
  return handle !== 'count' && handle !== 'ratio'
}

/** What a handle's label shows after its name: the radius, the point count, or the ratio. */
export function shapeHandleValue(node: SceneNode, handle: ShapeHandleKind): string {
  if (handle === 'count') return String(node.pointCount)
  if (handle === 'ratio') return `${Math.round(node.starInnerRadius * 100)}%`
  return String(Math.round(cornerRadiusOf(node, handle)))
}

/** A node-local point relative to the shape's centre, with its ellipse scaled to a unit circle. */
function unitOffset(node: SceneNode, local: Vector): Vector {
  return {
    x: (local.x - node.width / 2) / (node.width / 2),
    y: (local.y - node.height / 2) / (node.height / 2)
  }
}

/**
 * The point count whose next outer point lies in the direction of a node-local point: a full turn
 * over the angle from the top point, clockwise, within Figma's range.
 */
export function pointCountAtPoint(node: SceneNode, local: Vector): number {
  const { x, y } = unitOffset(node, local)
  let angle = Math.atan2(x, -y)
  if (angle <= 0) angle += 2 * Math.PI
  const count = Math.round((2 * Math.PI) / angle)
  return clamp(count, POINT_COUNT_RANGE.min, POINT_COUNT_RANGE.max)
}

/** The inner ratio of a star whose inner point lies as far from the centre as a node-local point. */
export function starRatioAtPoint(node: SceneNode, local: Vector): number {
  const { x, y } = unitOffset(node, local)
  return Math.min(Math.round(Math.hypot(x, y) * 100) / 100, 1)
}

/**
 * The radius whose arc centre lies under a node-local point, from its distance along the corner's
 * bisector, in whole pixels, or in steps of 10 with Shift.
 */
export function cornerRadiusAtPoint(
  node: SceneNode,
  corner: RadiusCorner,
  local: Vector,
  snap: boolean
): number {
  const shape = radiusCorners(node).find((candidate) => candidate.corner === corner)
  if (!shape) return 0
  const { vertex, inward, factor, max } = shape
  const distance = (local.x - vertex.x) * inward.x + (local.y - vertex.y) * inward.y
  const step = snap ? SHAPE_HANDLE.snapStep : 1
  return Math.min(Math.max(Math.round((distance * factor) / step) * step, 0), max)
}

/** The fields that set one corner, or all of them, to a radius. */
export function cornerRadiusChanges(
  node: SceneNode,
  corner: RadiusCorner,
  radius: number,
  single: boolean
): Partial<SceneNode> {
  if (corner === 'point') return { cornerRadius: radius }
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
