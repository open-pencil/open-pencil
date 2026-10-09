import type { Fill, GradientStop, GradientTransform, Vector } from '@open-pencil/scene-graph'

/**
 * On-canvas gradient handles, as Figma desktop 126 draws and drags them. A gradient's transform
 * maps gradient space into the layer's unit square; a linear gradient runs from (1, 0) to (0, 0)
 * of gradient space, the others are centred on (0.5, 0.5) with radius 0.5.
 */

export type GradientHandle = 'start' | 'end' | 'center' | 'radius-x' | 'radius-y'
export type GradientFillType = Extract<
  Fill['type'],
  'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'
>

export interface GradientHandles {
  start: Vector
  end: Vector
  center: Vector
  /** The second axis of a radial, angular, or diamond gradient. */
  radiusY?: Vector
}

/** Figma's 15° steps while Shift is held. */
const SNAP_ANGLE = Math.PI / 12

export function isGradientFill(type: Fill['type']): type is GradientFillType {
  return (
    type === 'GRADIENT_LINEAR' ||
    type === 'GRADIENT_RADIAL' ||
    type === 'GRADIENT_ANGULAR' ||
    type === 'GRADIENT_DIAMOND'
  )
}

function point(t: GradientTransform, width: number, height: number, x: number, y: number) {
  return {
    x: (t.m00 * x + t.m01 * y + t.m02) * width,
    y: (t.m10 * x + t.m11 * y + t.m12) * height
  }
}

/** The handles in the layer's own pixels. */
export function gradientHandles(
  type: GradientFillType,
  t: GradientTransform,
  width: number,
  height: number
): GradientHandles {
  if (type === 'GRADIENT_LINEAR') {
    const start = point(t, width, height, 1, 0)
    const end = point(t, width, height, 0, 0)
    return { start, end, center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
  }
  const center = point(t, width, height, 0.5, 0.5)
  return {
    start: center,
    end: point(t, width, height, 1, 0.5),
    center,
    radiusY: point(t, width, height, 0.5, 1)
  }
}

/** Where a stop sits in the layer's pixels: on the line, or on the ellipse for an angular one. */
export function gradientStopPoint(
  type: GradientFillType,
  t: GradientTransform,
  width: number,
  height: number,
  position: number
): Vector {
  if (type === 'GRADIENT_ANGULAR') {
    const angle = position * 2 * Math.PI
    return point(t, width, height, 0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle))
  }
  const { start, end } = gradientHandles(type, t, width, height)
  return { x: start.x + (end.x - start.x) * position, y: start.y + (end.y - start.y) * position }
}

/** The stop position nearest a point in the layer's pixels, from 0 to 1. */
export function gradientStopPosition(
  type: GradientFillType,
  t: GradientTransform,
  width: number,
  height: number,
  local: Vector
): number {
  if (type === 'GRADIENT_ANGULAR') {
    const det = t.m00 * t.m11 - t.m01 * t.m10
    if (Math.abs(det) < 1e-12 || width <= 0 || height <= 0) return 0
    const ux = local.x / width - t.m02
    const uy = local.y / height - t.m12
    const gx = (t.m11 * ux - t.m01 * uy) / det
    const gy = (-t.m10 * ux + t.m00 * uy) / det
    const turn = Math.atan2(gy - 0.5, gx - 0.5) / (2 * Math.PI)
    return turn < 0 ? turn + 1 : turn
  }
  const { start, end } = gradientHandles(type, t, width, height)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = dx * dx + dy * dy
  if (length < 1e-12) return 0
  const along = ((local.x - start.x) * dx + (local.y - start.y) * dy) / length
  return Math.min(1, Math.max(0, along))
}

function snapDirection(origin: Vector, position: Vector, snap: boolean): Vector {
  if (!snap) return position
  const dx = position.x - origin.x
  const dy = position.y - origin.y
  const angle = Math.round(Math.atan2(dy, dx) / SNAP_ANGLE) * SNAP_ANGLE
  const length = Math.hypot(dx, dy)
  return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length }
}

/**
 * The transform after dragging one handle to a point in the layer's pixels. Only that handle
 * moves, exactly with the pointer; Shift turns its direction in 15° steps and keeps its length.
 */
export function moveGradientHandle(
  type: GradientFillType,
  original: GradientTransform,
  width: number,
  height: number,
  handle: GradientHandle,
  position: Vector,
  snap = false
): GradientTransform {
  if (width <= 0 || height <= 0) return original
  const handles = gradientHandles(type, original, width, height)
  if (handle === 'center') {
    return {
      ...original,
      m02: original.m02 + (position.x - handles.center.x) / width,
      m12: original.m12 + (position.y - handles.center.y) / height
    }
  }
  if (type === 'GRADIENT_LINEAR') {
    const start = handle === 'start' ? snapDirection(handles.end, position, snap) : handles.start
    const end = handle === 'end' ? snapDirection(handles.start, position, snap) : handles.end
    if (Math.hypot(start.x - end.x, start.y - end.y) < 0.001) return original
    return {
      ...original,
      m00: (start.x - end.x) / width,
      m10: (start.y - end.y) / height,
      m01: -(start.y - end.y) / height,
      m11: (start.x - end.x) / width,
      m02: end.x / width,
      m12: end.y / height
    }
  }
  const center = handles.center
  let radiusX = handles.end
  let radiusY = handles.radiusY ?? center
  if (handle === 'radius-x' || handle === 'end') {
    radiusX = snapDirection(center, position, snap)
    // The second axis turns with the first, as in Figma.
    const angle =
      Math.atan2(radiusX.y - center.y, radiusX.x - center.x) -
      Math.atan2(handles.end.y - center.y, handles.end.x - center.x)
    const dx = radiusY.x - center.x
    const dy = radiusY.y - center.y
    radiusY = {
      x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle)
    }
  } else if (handle === 'radius-y') {
    radiusY = snapDirection(center, position, snap)
  }
  const m00 = (2 * (radiusX.x - center.x)) / width
  const m10 = (2 * (radiusX.y - center.y)) / height
  const m01 = (2 * (radiusY.x - center.x)) / width
  const m11 = (2 * (radiusY.y - center.y)) / height
  if (Math.abs(m00 * m11 - m01 * m10) < 1e-8) return original
  return {
    m00,
    m01,
    m10,
    m11,
    m02: center.x / width - (m00 + m01) / 2,
    m12: center.y / height - (m10 + m11) / 2
  }
}

/** Screen-pixel sizes of the handles, measured on Figma desktop 126. */
export const GRADIENT_HANDLE = {
  /** Stop squares, including their 2 px border and 1 px white ring. */
  stopSize: 24,
  /** From the square's edge to the point it marks, where its pointer ends. */
  stopGap: 5.5,
  dotRadius: 4
} as const

export interface GradientStopLayout {
  index: number
  /** The point on the line or ellipse the stop marks. */
  anchor: Vector
  /** The centre of its square. */
  center: Vector
  /** Unit vector from the square towards its anchor. */
  pointing: Vector
}

export interface GradientHandleLayout {
  type: GradientFillType
  dots: Array<{ handle: GradientHandle; point: Vector }>
  line: { from: Vector; to: Vector }
  /** The angular gradient's ellipse: centre and its two axis ends. */
  ellipse?: { center: Vector; radiusX: Vector; radiusY: Vector }
  stops: GradientStopLayout[]
}

/**
 * Where the handles of a gradient sit on screen, for drawing and for hit testing alike.
 * `toScreen` maps a point in the layer's pixels to screen pixels.
 */
export function gradientHandleLayout(
  type: GradientFillType,
  t: GradientTransform,
  stops: readonly GradientStop[],
  width: number,
  height: number,
  toScreen: (local: Vector) => Vector
): GradientHandleLayout {
  const local = gradientHandles(type, t, width, height)
  const start = toScreen(local.start)
  const end = toScreen(local.end)
  const center = toScreen(local.center)
  const radiusY = local.radiusY ? toScreen(local.radiusY) : undefined
  const offset = GRADIENT_HANDLE.stopGap + GRADIENT_HANDLE.stopSize / 2
  const along = { x: end.x - start.x, y: end.y - start.y }
  const length = Math.hypot(along.x, along.y) || 1
  // Above a left-to-right line: the left-hand normal of its direction.
  const above = { x: along.y / length, y: -along.x / length }
  const stopLayouts = stops.map((stop, index): GradientStopLayout => {
    const anchor = toScreen(gradientStopPoint(type, t, width, height, stop.position))
    let outward = above
    if (type === 'GRADIENT_ANGULAR') {
      const dx = anchor.x - center.x
      const dy = anchor.y - center.y
      const distance = Math.hypot(dx, dy) || 1
      outward = { x: dx / distance, y: dy / distance }
    }
    return {
      index,
      anchor,
      center: { x: anchor.x + outward.x * offset, y: anchor.y + outward.y * offset },
      pointing: { x: -outward.x, y: -outward.y }
    }
  })
  if (type === 'GRADIENT_LINEAR') {
    return {
      type,
      dots: [
        { handle: 'start', point: start },
        { handle: 'end', point: end }
      ],
      line: { from: start, to: end },
      stops: stopLayouts
    }
  }
  return {
    type,
    dots: [
      { handle: 'center', point: center },
      { handle: 'radius-x', point: end },
      ...(radiusY ? [{ handle: 'radius-y' as const, point: radiusY }] : [])
    ],
    line: { from: center, to: end },
    ellipse: type === 'GRADIENT_ANGULAR' && radiusY ? { center, radiusX: end, radiusY } : undefined,
    stops: stopLayouts
  }
}

export type GradientHit =
  | { kind: 'handle'; handle: GradientHandle }
  | { kind: 'stop'; index: number }

/** The handle under a screen point: squares first, then dots, then the line next to a stop. */
export function hitTestGradientHandles(
  layout: GradientHandleLayout,
  screen: Vector
): GradientHit | null {
  const half = GRADIENT_HANDLE.stopSize / 2
  for (let index = layout.stops.length - 1; index >= 0; index--) {
    const stop = layout.stops[index]
    if (Math.abs(screen.x - stop.center.x) <= half && Math.abs(screen.y - stop.center.y) <= half)
      return { kind: 'stop', index: stop.index }
  }
  for (const dot of layout.dots) {
    if (Math.hypot(screen.x - dot.point.x, screen.y - dot.point.y) <= GRADIENT_HANDLE.dotRadius + 3)
      return { kind: 'handle', handle: dot.handle }
  }
  // Pressing the line beside a stop takes that stop, as in Figma.
  for (const stop of layout.stops) {
    if (Math.hypot(screen.x - stop.anchor.x, screen.y - stop.anchor.y) <= half)
      return { kind: 'stop', index: stop.index }
  }
  return null
}
