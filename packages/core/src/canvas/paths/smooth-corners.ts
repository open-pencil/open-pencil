import type { SceneNode } from '@open-pencil/scene-graph'

/** What a rectangle's smoothed corners are drawn from. */
export type SmoothRectNode = Pick<
  SceneNode,
  | 'cornerRadius'
  | 'cornerSmoothing'
  | 'independentCorners'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomRightRadius'
  | 'bottomLeftRadius'
>

/**
 * Where a smoothed rectangle is traced: a CanvasKit `PathBuilder`, or a writer of SVG path data.
 * `arcToRotated` takes CanvasKit's arguments, which match an SVG arc's.
 */
export interface SmoothCornerSink {
  moveTo(x: number, y: number): unknown
  lineTo(x: number, y: number): unknown
  cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): unknown
  arcToRotated(
    rx: number,
    ry: number,
    xAxisRotate: number,
    useSmallArc: boolean,
    isCCW: boolean,
    x: number,
    y: number
  ): unknown
  close(): unknown
}

type SmoothCornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'

type SmoothCorner = {
  radius: number
  budget: number
}

type SmoothCornerPathParams = {
  a: number
  b: number
  c: number
  d: number
  p: number
  radius: number
  arcSectionLength: number
}

function smoothCornerRadii(
  node: SmoothRectNode,
  width: number,
  height: number,
  spread: number
): Record<SmoothCornerKey, SmoothCorner> {
  const radius = (value: number) => Math.max(0, value + spread)
  const radii: Record<SmoothCornerKey, number> = node.independentCorners
    ? {
        topLeft: radius(node.topLeftRadius),
        topRight: radius(node.topRightRadius),
        bottomRight: radius(node.bottomRightRadius),
        bottomLeft: radius(node.bottomLeftRadius)
      }
    : {
        topLeft: radius(node.cornerRadius),
        topRight: radius(node.cornerRadius),
        bottomRight: radius(node.cornerRadius),
        bottomLeft: radius(node.cornerRadius)
      }

  if (
    radii.topLeft === radii.topRight &&
    radii.topRight === radii.bottomRight &&
    radii.bottomRight === radii.bottomLeft
  ) {
    const budget = Math.min(width, height) / 2
    const clampedRadius = Math.min(radii.topLeft, budget)
    return {
      topLeft: { radius: clampedRadius, budget },
      topRight: { radius: clampedRadius, budget },
      bottomRight: { radius: clampedRadius, budget },
      bottomLeft: { radius: clampedRadius, budget }
    }
  }

  const budgets: Record<SmoothCornerKey, number> = {
    topLeft: -1,
    topRight: -1,
    bottomRight: -1,
    bottomLeft: -1
  }
  const adjacentByCorner: Record<
    SmoothCornerKey,
    Array<{ corner: SmoothCornerKey; sideLength: number }>
  > = {
    topLeft: [
      { corner: 'topRight', sideLength: width },
      { corner: 'bottomLeft', sideLength: height }
    ],
    topRight: [
      { corner: 'topLeft', sideLength: width },
      { corner: 'bottomRight', sideLength: height }
    ],
    bottomRight: [
      { corner: 'bottomLeft', sideLength: width },
      { corner: 'topRight', sideLength: height }
    ],
    bottomLeft: [
      { corner: 'bottomRight', sideLength: width },
      { corner: 'topLeft', sideLength: height }
    ]
  }

  for (const corner of (Object.keys(radii) as SmoothCornerKey[]).sort(
    (a, b) => radii[b] - radii[a]
  )) {
    const cornerRadius = radii[corner]
    const budget = Math.min(
      ...adjacentByCorner[corner].map((adjacent) => {
        const adjacentRadius = radii[adjacent.corner]
        if (cornerRadius === 0 && adjacentRadius === 0) return 0
        if (budgets[adjacent.corner] >= 0) return adjacent.sideLength - budgets[adjacent.corner]
        return (cornerRadius / (cornerRadius + adjacentRadius)) * adjacent.sideLength
      })
    )
    budgets[corner] = budget
    radii[corner] = Math.min(cornerRadius, budget)
  }

  return {
    topLeft: { radius: radii.topLeft, budget: budgets.topLeft },
    topRight: { radius: radii.topRight, budget: budgets.topRight },
    bottomRight: { radius: radii.bottomRight, budget: budgets.bottomRight },
    bottomLeft: { radius: radii.bottomLeft, budget: budgets.bottomLeft }
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function smoothCornerPathParams(corner: SmoothCorner, smoothing: number): SmoothCornerPathParams {
  let cornerSmoothing = smoothing
  let p = (1 + cornerSmoothing) * corner.radius
  if (corner.radius > 0) {
    const maxSmoothing = corner.budget / corner.radius - 1
    cornerSmoothing = Math.min(cornerSmoothing, maxSmoothing)
    p = Math.min(p, corner.budget)
  }

  const arcMeasure = 90 * (1 - cornerSmoothing)
  const arcSectionLength = Math.sin(degreesToRadians(arcMeasure / 2)) * corner.radius * Math.sqrt(2)
  const angleAlpha = (90 - arcMeasure) / 2
  const p3ToP4Distance = corner.radius * Math.tan(degreesToRadians(angleAlpha / 2))
  const angleBeta = 45 * cornerSmoothing
  const c = p3ToP4Distance * Math.cos(degreesToRadians(angleBeta))
  const d = c * Math.tan(degreesToRadians(angleBeta))
  const b = (p - arcSectionLength - c - d) / 3

  return {
    a: 2 * b,
    b,
    c,
    d,
    p,
    radius: corner.radius,
    arcSectionLength
  }
}

function drawTopRightSmoothCorner(
  path: SmoothCornerSink,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x + corner.p, y)
    return
  }
  path.cubicTo(
    x + corner.a,
    y,
    x + corner.a + corner.b,
    y,
    x + corner.a + corner.b + corner.c,
    y + corner.d
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x + corner.p - corner.d,
    y + corner.p - corner.a - corner.b - corner.c
  )
  path.cubicTo(
    x + corner.p,
    y + corner.p - corner.a - corner.b,
    x + corner.p,
    y + corner.p - corner.a,
    x + corner.p,
    y + corner.p
  )
}

function drawBottomRightSmoothCorner(
  path: SmoothCornerSink,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x, y + corner.p)
    return
  }
  path.cubicTo(
    x,
    y + corner.a,
    x,
    y + corner.a + corner.b,
    x - corner.d,
    y + corner.a + corner.b + corner.c
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x - corner.p + corner.a + corner.b + corner.c,
    y + corner.p - corner.d
  )
  path.cubicTo(
    x - corner.p + corner.a + corner.b,
    y + corner.p,
    x - corner.p + corner.a,
    y + corner.p,
    x - corner.p,
    y + corner.p
  )
}

function drawBottomLeftSmoothCorner(
  path: SmoothCornerSink,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x - corner.p, y)
    return
  }
  path.cubicTo(
    x - corner.a,
    y,
    x - corner.a - corner.b,
    y,
    x - corner.a - corner.b - corner.c,
    y - corner.d
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x - corner.p + corner.d,
    y - corner.p + corner.a + corner.b + corner.c
  )
  path.cubicTo(
    x - corner.p,
    y - corner.p + corner.a + corner.b,
    x - corner.p,
    y - corner.p + corner.a,
    x - corner.p,
    y - corner.p
  )
}

function drawTopLeftSmoothCorner(
  path: SmoothCornerSink,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x, y - corner.p)
    return
  }
  path.cubicTo(
    x,
    y - corner.a,
    x,
    y - corner.a - corner.b,
    x + corner.d,
    y - corner.a - corner.b - corner.c
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x + corner.p - corner.a - corner.b - corner.c,
    y - corner.p + corner.d
  )
  path.cubicTo(
    x + corner.p - corner.a - corner.b,
    y - corner.p,
    x + corner.p - corner.a,
    y - corner.p,
    x + corner.p,
    y - corner.p
  )
}

/**
 * Trace a rectangle with smoothed corners into `path`, as Figma rounds them. False, with nothing
 * traced, when no corner is rounded, so the caller can draw a plain rectangle.
 */
export function traceSmoothRect(
  path: SmoothCornerSink,
  node: SmoothRectNode,
  box: { left: number; top: number; right: number; bottom: number },
  spread = 0
): boolean {
  const { left, top, right, bottom } = box
  const smoothing = Math.max(0, Math.min(node.cornerSmoothing, 1))
  const corners = smoothCornerRadii(node, right - left, bottom - top, spread)
  const topLeftCorner = smoothCornerPathParams(corners.topLeft, smoothing)
  const topRightCorner = smoothCornerPathParams(corners.topRight, smoothing)
  const bottomRightCorner = smoothCornerPathParams(corners.bottomRight, smoothing)
  const bottomLeftCorner = smoothCornerPathParams(corners.bottomLeft, smoothing)

  if (
    topLeftCorner.radius === 0 &&
    topRightCorner.radius === 0 &&
    bottomRightCorner.radius === 0 &&
    bottomLeftCorner.radius === 0
  ) {
    return false
  }

  path.moveTo(right - topRightCorner.p, top)
  drawTopRightSmoothCorner(path, topRightCorner, right - topRightCorner.p, top)
  path.lineTo(right, bottom - bottomRightCorner.p)
  drawBottomRightSmoothCorner(path, bottomRightCorner, right, bottom - bottomRightCorner.p)
  path.lineTo(left + bottomLeftCorner.p, bottom)
  drawBottomLeftSmoothCorner(path, bottomLeftCorner, left + bottomLeftCorner.p, bottom)
  path.lineTo(left, top + topLeftCorner.p)
  drawTopLeftSmoothCorner(path, topLeftCorner, left, top + topLeftCorner.p)
  path.close()
  return true
}
