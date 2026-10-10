import type { GradientStop, GradientTransform, Vector } from '@open-pencil/scene-graph'
import {
  applyGradientTransform,
  ellipticalGradientTransform,
  invertGradientTransform,
  linearGradientTransform,
  type GradientFillType
} from '@open-pencil/scene-graph/gradient'

/**
 * On-canvas gradient handles, as Figma desktop 126 draws and drags them, built on the paint
 * convention in `@open-pencil/scene-graph/gradient`.
 */

export type GradientHandle = 'start' | 'end' | 'center' | 'radius-x' | 'radius-y'

export interface GradientHandles {
  start: Vector
  end: Vector
  center: Vector
  /** The second axis of a radial, angular, or diamond gradient. */
  radiusY?: Vector
}

/** Figma's 15° steps while Shift is held. */
const SNAP_ANGLE = Math.PI / 12

/** Where a point of gradient space falls in a `width` × `height` layer. */
function point(toLayer: GradientTransform, width: number, height: number, x: number, y: number) {
  const unit = applyGradientTransform(toLayer, { x, y })
  return { x: unit.x * width, y: unit.y * height }
}

/** The handles in the layer's own pixels. */
export function gradientHandles(
  type: GradientFillType,
  t: GradientTransform,
  width: number,
  height: number
): GradientHandles {
  const toLayer = invertGradientTransform(t)
  if (type === 'GRADIENT_LINEAR') {
    const start = point(toLayer, width, height, 0, 0.5)
    const end = point(toLayer, width, height, 1, 0.5)
    return { start, end, center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
  }
  const center = point(toLayer, width, height, 0.5, 0.5)
  return {
    start: center,
    end: point(toLayer, width, height, 1, 0.5),
    center,
    radiusY: point(toLayer, width, height, 0.5, 1)
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
    return point(
      invertGradientTransform(t),
      width,
      height,
      0.5 + 0.5 * Math.cos(angle),
      0.5 + 0.5 * Math.sin(angle)
    )
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
    if (width <= 0 || height <= 0) return 0
    const g = applyGradientTransform(t, { x: local.x / width, y: local.y / height })
    const turn = Math.atan2(g.y - 0.5, g.x - 0.5) / (2 * Math.PI)
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

function unit(p: Vector, width: number, height: number): Vector {
  return { x: p.x / width, y: p.y / height }
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
    // Moving the centre slides the whole gradient: gradient space shifts the other way.
    const dx = (position.x - handles.center.x) / width
    const dy = (position.y - handles.center.y) / height
    return {
      ...original,
      m02: original.m02 - (original.m00 * dx + original.m01 * dy),
      m12: original.m12 - (original.m10 * dx + original.m11 * dy)
    }
  }
  if (type === 'GRADIENT_LINEAR') {
    const start = handle === 'start' ? snapDirection(handles.end, position, snap) : handles.start
    const end = handle === 'end' ? snapDirection(handles.start, position, snap) : handles.end
    if (Math.hypot(start.x - end.x, start.y - end.y) < 0.001) return original
    const toLayer = invertGradientTransform(original)
    const along = Math.hypot(toLayer.m00 * width, toLayer.m10 * height)
    const across = Math.hypot(toLayer.m01 * width, toLayer.m11 * height)
    return linearGradientTransform(
      unit(start, width, height),
      unit(end, width, height),
      width,
      height,
      along > 1e-9 ? across / along : height / width
    )
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
  const ax = radiusX.x - center.x
  const ay = radiusX.y - center.y
  const bx = radiusY.x - center.x
  const by = radiusY.y - center.y
  if (Math.abs(ax * by - ay * bx) < 1e-6) return original
  return ellipticalGradientTransform(
    unit(center, width, height),
    unit(radiusX, width, height),
    unit(radiusY, width, height)
  )
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
