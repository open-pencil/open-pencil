import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, Stroke } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { nodeHasSmoothCorners } from '#core/canvas/shapes'
import { normalizeDashPattern } from '#core/canvas/strokes'

/** Arc points per wedge: a chord across at most this many degrees stays clear of the ring. */
const WEDGE_STEP = 30

/** A rectangle's stroke weights, side by side: top, right, bottom, left. */
export type SideWeights = readonly [number, number, number, number]

/** The weight of each side of `node` under `stroke`, its own when its sides have their own. */
export function strokeSideWeights(node: SceneNode, stroke: Stroke): SideWeights {
  if (!node.independentStrokeWeights)
    return [stroke.weight, stroke.weight, stroke.weight, stroke.weight]
  return [
    node.borderTopWeight,
    node.borderRightWeight,
    node.borderBottomWeight,
    node.borderLeftWeight
  ]
}

/** The share of a stroke's weight that lies outside the shape it outlines. */
export function strokeAlignShare(align: Stroke['align']): number {
  if (align === 'OUTSIDE') return 1
  if (align === 'CENTER') return 0.5
  return 0
}

function cornerRadii(node: SceneNode): [number, number, number, number] {
  if (!node.independentCorners) {
    return [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius]
  }
  return [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
}

/**
 * The outer and inner edges of a frame's stroke with sides of their own weights, as rounded
 * rectangles in CanvasKit's layout. Figma 126 strokes them as one ring: each inner corner
 * shrinks by the width of its own side on each axis, and each outer corner is a circle grown by
 * the narrower of its two sides, a side without a stroke not counting. `grow` pushes the outer
 * edge out and the inner edge in, as a shadow's spread grows a ring. `weights` defaults to the
 * node's own sides.
 */
export function sideStrokeRRects(
  node: SceneNode,
  align: Stroke['align'],
  grow = 0,
  weights: SideWeights = [
    node.borderTopWeight,
    node.borderRightWeight,
    node.borderBottomWeight,
    node.borderLeftWeight
  ]
): { outer: Float32Array; inner: Float32Array | null } {
  const share = strokeAlignShare(align)
  const [top, right, bottom, left] = weights.map((weight) => weight * share + grow)
  const [topIn, rightIn, bottomIn, leftIn] = weights.map((weight) => weight * (1 - share) + grow)
  const [tWeight, rWeight, bWeight, lWeight] = weights
  const [tl, tr, br, bl] = cornerRadii(node)
  const out = (radius: number, a: number, aWeight: number, b: number, bWeight: number) => {
    if (radius <= 0) return 0
    const stroked = [aWeight > 0 ? a : null, bWeight > 0 ? b : null].filter((side) => side !== null)
    return Math.max(0, radius + (stroked.length > 0 ? Math.min(...stroked) : grow))
  }
  const into = (radius: number, side: number) => Math.max(0, radius - side)
  const tlOut = out(tl, top, tWeight, left, lWeight)
  const trOut = out(tr, top, tWeight, right, rWeight)
  const brOut = out(br, bottom, bWeight, right, rWeight)
  const blOut = out(bl, bottom, bWeight, left, lWeight)
  const outer = new Float32Array([
    -left,
    -top,
    node.width + right,
    node.height + bottom,
    tlOut,
    tlOut,
    trOut,
    trOut,
    brOut,
    brOut,
    blOut,
    blOut
  ])
  if (leftIn + rightIn >= node.width || topIn + bottomIn >= node.height) {
    return { outer, inner: null }
  }
  const inner = new Float32Array([
    leftIn,
    topIn,
    node.width - rightIn,
    node.height - bottomIn,
    into(tl, leftIn),
    into(tl, topIn),
    into(tr, rightIn),
    into(tr, topIn),
    into(br, rightIn),
    into(br, bottomIn),
    into(bl, leftIn),
    into(bl, bottomIn)
  ])
  return { outer, inner }
}

/** Strokes a frame whose sides have their own weights, as one ring like Figma, dashed or not. */
export function drawIndividualSideStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: Stroke
): void {
  const pattern = normalizeDashPattern(stroke.dashPattern)
  if (pattern.length > 0 && hasFlatDashes(node, stroke)) {
    drawDashedRectStroke(r, canvas, node, stroke, strokeSideWeights(node, stroke), pattern)
    return
  }
  if (pattern.length > 0) {
    drawDashedSideLines(r, canvas, node, stroke.align)
    return
  }
  r.strokePaint.setStyle(r.ck.PaintStyle.Fill)
  try {
    const { outer, inner } = sideStrokeRRects(node, stroke.align)
    if (inner) canvas.drawDRRect(outer, inner, r.strokePaint)
    else canvas.drawRRect(outer, r.strokePaint)
  } finally {
    r.strokePaint.setStyle(r.ck.PaintStyle.Stroke)
  }
}

/**
 * A dash pattern stretched to `length` as Figma 126 lays dashes along a side or a line: the length
 * holds a whole number of periods, rounded to the nearest, with half a dash at each end. `offset`
 * is how far before the start the stretched pattern begins.
 */
export function fittedDashPattern(
  length: number,
  pattern: readonly number[]
): { intervals: number[]; offset: number } | null {
  const period = pattern.reduce((sum, size) => sum + size, 0)
  if (period <= 0 || length <= 0) return null
  const scale = length / (Math.max(1, Math.round(length / period)) * period)
  return { intervals: pattern.map((size) => size * scale), offset: (pattern[0] * scale) / 2 }
}

/** Where one side's dashes fall along its length, laid out by `fittedDashPattern`. */
export function sideDashSpans(length: number, pattern: readonly number[]): Array<[number, number]> {
  const fitted = fittedDashPattern(length, pattern)
  if (!fitted) return [[0, Math.max(0, length)]]
  const { intervals } = fitted
  const spans: Array<[number, number]> = []
  let position = -fitted.offset
  for (let index = 0; position < length; index++) {
    const size = intervals[index % intervals.length]
    const start = Math.max(0, position)
    const end = Math.min(length, position + size)
    if (index % 2 === 0 && end > start) spans.push([start, end])
    position += size
  }
  return spans
}

/** Dashes with flat ends on corners without smoothing, which the layout below draws. */
function hasFlatDashes(node: SceneNode, stroke: Stroke): boolean {
  return !nodeHasSmoothCorners(node) && (stroke.cap ?? node.strokeCap) === 'NONE'
}

/**
 * Whether Figma's dash layout below applies: a rectangle without smoothed corners whose
 * dashes have flat ends, and on sharp corners a mitered join, which the corner squares are.
 */
export function strokeDashesByOutline(node: SceneNode, stroke: Stroke): boolean {
  if (!hasFlatDashes(node, stroke)) return false
  const rounded = fittedCornerRadii(node).some((radius) => radius > 0)
  return rounded || (stroke.join ?? node.strokeJoin) === 'MITER'
}

/**
 * Draws a dashed stroke on a rectangle as Figma 126 does. The stroke is one ring, like an
 * undashed one, and each part of the outline is dashed on its own: every straight side between
 * its corners and every corner arc holds a whole number of periods, rounded to the nearest, with
 * half a dash at each end. Arcs are measured on the shape's edge and cut through the corner's
 * centre, and a sharp corner is filled when both of its sides are stroked.
 */
export function drawDashedRectStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: Stroke,
  weights: SideWeights,
  pattern: readonly number[]
): void {
  // Skia draws a stroke of width 0 as a hairline, so a ring without weight draws nothing.
  if (weights.every((weight) => weight <= 0)) return
  const dashed: DashedRect = {
    node,
    align: stroke.align,
    weights,
    pattern,
    radii: fittedCornerRadii(node)
  }
  const inset = weights[0] * (1 - strokeAlignShare(stroke.align))
  const even = weights.every((weight) => weight === weights[0])
  r.strokePaint.setPathEffect(null)
  drawDashRects(r, canvas, dashed)
  if (even && dashed.radii.every((radius) => radius === 0 || radius >= inset)) {
    drawDashedArcs(r, canvas, dashed)
  } else {
    drawClippedCornerDashes(r, canvas, dashed)
  }
}

/** A dashed rectangle stroke: the node, its alignment and side weights, and the corners Skia draws. */
interface DashedRect {
  node: SceneNode
  align: Stroke['align']
  weights: SideWeights
  pattern: readonly number[]
  radii: [number, number, number, number]
}

/**
 * The dashes along the straight sides, and the squares of sharp corners between stroked sides,
 * filled as one path so a translucent stroke does not darken where they meet.
 */
function drawDashRects(r: SkiaRenderer, canvas: Canvas, dashed: DashedRect): void {
  const { node, align, weights, pattern } = dashed
  const [tl, tr, br, bl] = dashed.radii
  const share = strokeAlignShare(align)
  const w = node.width
  const h = node.height
  const [top, right, bottom, left] = weights
  const out = (weight: number) => weight * share
  const into = (weight: number) => weight * (1 - share)
  const builder = new r.ck.PathBuilder()
  const rect = (l: number, t: number, rr: number, b: number) =>
    builder.addRect(r.ck.LTRBRect(l, t, rr, b))
  // Each side: its weight, the length between its corners, and the rectangle of one dash on it.
  const sides: Array<[number, number, (s: number, e: number) => void]> = [
    [top, w - tl - tr, (s, e) => rect(tl + s, -out(top), tl + e, into(top))],
    [bottom, w - bl - br, (s, e) => rect(bl + s, h - into(bottom), bl + e, h + out(bottom))],
    [left, h - tl - bl, (s, e) => rect(-out(left), tl + s, into(left), tl + e)],
    [right, h - tr - br, (s, e) => rect(w - into(right), tr + s, w + out(right), tr + e)]
  ]
  for (const [weight, length, dash] of sides) {
    if (weight > 0) for (const [s, e] of sideDashSpans(length, pattern)) dash(s, e)
  }
  // Each sharp corner between two stroked sides: its square, outside the shape.
  const corners: Array<[number, number, number, () => void]> = [
    [tl, top, left, () => rect(-out(left), -out(top), 0, 0)],
    [tr, top, right, () => rect(w, -out(top), w + out(right), 0)],
    [br, bottom, right, () => rect(w, h, w + out(right), h + out(bottom))],
    [bl, bottom, left, () => rect(-out(left), h, 0, h + out(bottom))]
  ]
  for (const [radius, a, b, square] of corners) if (radius === 0 && a > 0 && b > 0) square()
  const path = builder.detachAndDelete()
  // An outer corner grown by its narrower side starts curving before the shape's corner does.
  const rounded = tl > 0 || tr > 0 || br > 0 || bl > 0
  r.strokePaint.setStyle(r.ck.PaintStyle.Fill)
  canvas.save()
  try {
    if (rounded) {
      const { outer } = sideStrokeRRects(node, align, 0, weights)
      canvas.clipRRect(outer, r.ck.ClipOp.Intersect, true)
    }
    canvas.drawPath(path, r.strokePaint)
  } finally {
    canvas.restore()
    r.strokePaint.setStyle(r.ck.PaintStyle.Stroke)
    path.delete()
  }
}

/**
 * The dashes around rounded corners of a stroke with one weight, as arcs with flat ends, which
 * Skia cuts through the arc's centre as Figma does.
 */
function drawDashedArcs(r: SkiaRenderer, canvas: Canvas, dashed: DashedRect): void {
  const { node, align, pattern } = dashed
  const [weight] = dashed.weights
  const [tl, tr, br, bl] = dashed.radii
  const { width: w, height: h } = node
  // The stroke's centre line runs this far outside the shape's edge.
  const shift = weight * (strokeAlignShare(align) - 0.5)
  r.strokePaint.setStrokeWidth(weight)
  r.strokePaint.setStrokeCap(r.ck.StrokeCap.Butt)
  const corner = (radius: number, cx: number, cy: number, startAngle: number) => {
    if (radius <= 0) return
    const arc = (Math.PI / 2) * radius
    const line = radius + shift
    const oval = r.ck.LTRBRect(cx - line, cy - line, cx + line, cy + line)
    for (const [s, e] of sideDashSpans(arc, pattern)) {
      canvas.drawArc(oval, startAngle + (s / arc) * 90, ((e - s) / arc) * 90, false, r.strokePaint)
    }
  }
  corner(tl, tl, tl, 180)
  corner(tr, w - tr, tr, 270)
  corner(br, w - br, h - br, 0)
  corner(bl, bl, h - bl, 90)
}

/**
 * The dashes around rounded corners of any other ring, as the ring clipped to each corner's box
 * and to a wedge from the corner's centre for every dash along its arc.
 */
function drawClippedCornerDashes(r: SkiaRenderer, canvas: Canvas, dashed: DashedRect): void {
  const { node, align, weights, pattern, radii } = dashed
  const { width: w, height: h } = node
  const share = strokeAlignShare(align)
  const [top, right, bottom, left] = weights.map((weight) => weight * share)
  const [tl, tr, br, bl] = radii
  const { outer, inner } = sideStrokeRRects(node, align, 0, weights)
  r.strokePaint.setStyle(r.ck.PaintStyle.Fill)
  const corner = (
    radius: number,
    cx: number,
    cy: number,
    startAngle: number,
    box: Float32Array
  ) => {
    if (radius <= 0) return
    // Far enough that a chord across a wedge clears the corner's whole box.
    const far = 2 * (radius + Math.max(top, right, bottom, left)) + 2
    const builder = new r.ck.PathBuilder()
    const arc = (Math.PI / 2) * radius
    for (const [s, e] of sideDashSpans(arc, pattern)) {
      const from = startAngle + (s / arc) * 90
      const to = startAngle + (e / arc) * 90
      const steps = Math.max(1, Math.ceil((to - from) / WEDGE_STEP))
      const points = [cx, cy]
      for (let step = 0; step <= steps; step++) {
        const angle = ((from + ((to - from) * step) / steps) * Math.PI) / 180
        points.push(cx + far * Math.cos(angle), cy + far * Math.sin(angle))
      }
      builder.addPolygon(points, true)
    }
    const wedges = builder.detachAndDelete()
    canvas.save()
    try {
      canvas.clipRect(box, r.ck.ClipOp.Intersect, true)
      canvas.clipPath(wedges, r.ck.ClipOp.Intersect, true)
      if (inner) canvas.drawDRRect(outer, inner, r.strokePaint)
      else canvas.drawRRect(outer, r.strokePaint)
    } finally {
      canvas.restore()
      wedges.delete()
    }
  }
  try {
    corner(tl, tl, tl, 180, r.ck.LTRBRect(-left, -top, tl, tl))
    corner(tr, w - tr, tr, 270, r.ck.LTRBRect(w - tr, -top, w + right, tr))
    corner(br, w - br, h - br, 0, r.ck.LTRBRect(w - br, h - br, w + right, h + bottom))
    corner(bl, bl, h - bl, 90, r.ck.LTRBRect(-left, h - bl, bl, h + bottom))
  } finally {
    r.strokePaint.setStyle(r.ck.PaintStyle.Stroke)
  }
}

/** Corner radii as Skia draws them: scaled down together when two corners overflow a side. */
function fittedCornerRadii(node: SceneNode): [number, number, number, number] {
  const [tl, tr, br, bl] = cornerRadii(node)
  const fit = (length: number, a: number, b: number) => (a + b > length ? length / (a + b) : 1)
  const scale = Math.min(
    fit(node.width, tl, tr),
    fit(node.width, bl, br),
    fit(node.height, tl, bl),
    fit(node.height, tr, br)
  )
  return [tl * scale, tr * scale, br * scale, bl * scale]
}

/**
 * Dashes with round or square ends, or on smoothed corners, which Figma's layout was not measured
 * for: straight dashed lines along each side, with the stroke paint's own dash effect and caps.
 */
function drawDashedSideLines(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  const w = node.width
  const h = node.height
  const inside = align === 'INSIDE'
  const outside = align === 'OUTSIDE'

  const tw = node.borderTopWeight
  if (tw > 0) {
    let y = 0
    if (inside) y = tw / 2
    else if (outside) y = -tw / 2
    r.strokePaint.setStrokeWidth(tw)
    canvas.drawLine(0, y, w, y, r.strokePaint)
  }

  const rw = node.borderRightWeight
  if (rw > 0) {
    let x = w
    if (inside) x = w - rw / 2
    else if (outside) x = w + rw / 2
    r.strokePaint.setStrokeWidth(rw)
    canvas.drawLine(x, 0, x, h, r.strokePaint)
  }

  const bw = node.borderBottomWeight
  if (bw > 0) {
    let y = h
    if (inside) y = h - bw / 2
    else if (outside) y = h + bw / 2
    r.strokePaint.setStrokeWidth(bw)
    canvas.drawLine(0, y, w, y, r.strokePaint)
  }

  const lw = node.borderLeftWeight
  if (lw > 0) {
    let x = 0
    if (inside) x = lw / 2
    else if (outside) x = -lw / 2
    r.strokePaint.setStrokeWidth(lw)
    canvas.drawLine(x, 0, x, h, r.strokePaint)
  }
}
