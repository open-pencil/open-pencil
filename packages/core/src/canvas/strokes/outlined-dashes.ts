import type { Canvas, CanvasKit, Path, PathBuilder } from 'canvaskit-wasm'

import type { SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { makeSmoothRRectPath, nodeHasSmoothCorners } from '#core/canvas/shapes'
import { getStrokeCapEntity, getStrokeJoinEntity } from '#core/canvas/strokes'
import { sideDashSpans } from '#core/canvas/strokes/sides'

/** Lengths closer than this count as touching. */
const EPSILON = 1e-3

type Span = [number, number]

/**
 * Draws a dashed stroke on a rectangle of one weight as Figma 126 does when its dashes have round
 * or square ends, its corners are smoothed, or its sharp corners do not miter. Each line and each
 * curve of the shape's edge, which makes a rounded corner one curve and a smoothed corner three,
 * is dashed on its own along the edge, and the dashes that meet where two of them join run on as
 * one. Each dash is stroked with the stroke's
 * cap and join, at double width and clipped to the shape for inside and outside strokes, as
 * Figma builds those.
 */
export function drawOutlinedDashes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: Stroke,
  pattern: readonly number[]
): void {
  const cap = stroke.cap ?? node.strokeCap
  const join = stroke.join ?? node.strokeJoin
  // Geometry changes do not all clear a node's paths, so the key carries what shapes the dashes.
  const corners = node.independentCorners
    ? `${node.topLeftRadius},${node.topRightRadius},${node.bottomRightRadius},${node.bottomLeftRadius}`
    : `${node.cornerRadius}`
  const shape = `${node.width}x${node.height}|${corners}|${node.cornerSmoothing}|${node.strokeMiterLimit}`
  const key = `${node.id}|outlined-dashes|${shape}|${stroke.align}|${stroke.weight}|${cap}|${join}|${pattern.join(',')}`
  let dashes = r.nodePaths.strokeOutline.get(key)
  const edge = edgePath(r, node)
  try {
    if (!dashes) {
      const path = dashPath(r, edge, pattern, {
        width: stroke.align === 'CENTER' ? stroke.weight : stroke.weight * 2,
        cap: getStrokeCapEntity(r, cap),
        join: getStrokeJoinEntity(r, join),
        miter_limit: node.strokeMiterLimit
      })
      dashes = path ? [path] : []
      r.nodePaths.store(r.nodePaths.strokeOutline, key, dashes)
    }
    r.strokePaint.setPathEffect(null)
    r.strokePaint.setStyle(r.ck.PaintStyle.Fill)
    canvas.save()
    try {
      if (stroke.align === 'INSIDE') canvas.clipPath(edge, r.ck.ClipOp.Intersect, true)
      if (stroke.align === 'OUTSIDE') canvas.clipPath(edge, r.ck.ClipOp.Difference, true)
      for (const path of dashes) canvas.drawPath(path, r.strokePaint)
    } finally {
      canvas.restore()
      r.strokePaint.setStyle(r.ck.PaintStyle.Stroke)
    }
  } finally {
    edge.delete()
  }
}

/** The shape's edge: its rectangle, rounded rectangle, or smoothed corners. */
function edgePath(r: SkiaRenderer, node: SceneNode): Path {
  if (nodeHasSmoothCorners(node)) return makeSmoothRRectPath(r, node)
  const builder = new r.ck.PathBuilder()
  builder.addRRect(r.makeRRect(node))
  return builder.detachAndDelete()
}

/** All dashes along `edge`, stroked with `options`, as one path. */
function dashPath(
  r: SkiaRenderer,
  edge: Path,
  pattern: readonly number[],
  options: Parameters<Path['makeStroked']>[0]
): Path | null {
  const pieces = outlinePieces(r, edge)
  const total = pieces.reduce((sum, [, length]) => sum + length, 0)
  if (total <= 0) return null
  const spans = mergeTouching(
    pieces.flatMap(([start, length]) =>
      length > EPSILON
        ? sideDashSpans(length, pattern).map(([s, e]): Span => [start + s, start + e])
        : []
    ),
    total
  )
  const iter = new r.ck.ContourMeasureIter(edge, true, 1)
  const contour = iter.next()
  iter.delete()
  if (!contour) return null
  const union = new r.ck.PathBuilder()
  try {
    for (const [start, end] of spans) {
      const line = new r.ck.PathBuilder()
      appendSegment(r.ck, line, contour.getSegment(start, Math.min(end, total), true), false)
      if (end > total) appendSegment(r.ck, line, contour.getSegment(0, end - total, true), true)
      const centre = line.detachAndDelete()
      const outline = centre.makeStroked(options)
      centre.delete()
      if (!outline) continue
      union.addPath(outline)
      outline.delete()
    }
  } finally {
    contour.delete()
  }
  return union.detachAndDelete()
}

/**
 * The outline split into the parts Figma dashes on its own, as [start, length] along it: each
 * line and each curve of it, so a smoothed corner's three curves are dashed one by one.
 */
function outlinePieces(r: SkiaRenderer, edge: Path): Span[] {
  const pieces: Span[] = []
  let position = 0
  let start: Vector = { x: 0, y: 0 }
  let point: Vector = { x: 0, y: 0 }
  const piece = (length: number, to: Vector) => {
    pieces.push([position, length])
    position += length
    point = to
  }
  forEachVerb(r.ck, edge, (verb, args) => {
    if (verb === r.ck.MOVE_VERB) {
      start = point = { x: args[0], y: args[1] }
    } else if (verb === r.ck.LINE_VERB) {
      const to = { x: args[0], y: args[1] }
      piece(Math.hypot(to.x - point.x, to.y - point.y), to)
    } else if (verb === r.ck.CLOSE_VERB) {
      const length = Math.hypot(start.x - point.x, start.y - point.y)
      if (length > EPSILON) piece(length, start)
    } else {
      // A conic's weight follows its end point.
      const at = args.length - (verb === r.ck.CONIC_VERB ? 3 : 2)
      piece(curveLength(r, point, verb, args), { x: args[at], y: args[at + 1] })
    }
  })
  return pieces
}

/** The length of one curve verb from `from`. */
function curveLength(r: SkiaRenderer, from: Vector, verb: number, args: Float32Array): number {
  const builder = new r.ck.PathBuilder()
  builder.moveTo(from.x, from.y)
  if (verb === r.ck.QUAD_VERB) builder.quadTo(args[0], args[1], args[2], args[3])
  else if (verb === r.ck.CONIC_VERB) builder.conicTo(args[0], args[1], args[2], args[3], args[4])
  else builder.cubicTo(args[0], args[1], args[2], args[3], args[4], args[5])
  const path = builder.detachAndDelete()
  const iter = new r.ck.ContourMeasureIter(path, false, 1)
  const contour = iter.next()
  const length = contour?.length() ?? 0
  contour?.delete()
  iter.delete()
  path.delete()
  return length
}

/**
 * Spans in order along a closed outline of length `total`, with spans that touch joined into one,
 * the last running past `total` into the first when they meet where the outline starts.
 */
function mergeTouching(spans: Span[], total: number): Span[] {
  const merged: Span[] = []
  for (const [start, end] of spans) {
    const last = merged.at(-1)
    if (last && start - last[1] < EPSILON) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  if (merged.length < 2) return merged
  const first = merged[0]
  const last = merged[merged.length - 1]
  if (first[0] < EPSILON && total - last[1] < EPSILON) {
    last[1] = total + first[1]
    merged.shift()
  }
  return merged
}

/** Calls `visit` with each verb of `path` and its coordinates, a conic's weight last. */
function forEachVerb(
  ck: CanvasKit,
  path: Path,
  visit: (verb: number, args: Float32Array) => void
): void {
  const cmds = path.toCmds()
  const counts = new Map([
    [ck.MOVE_VERB, 2],
    [ck.LINE_VERB, 2],
    [ck.QUAD_VERB, 4],
    [ck.CONIC_VERB, 5],
    [ck.CUBIC_VERB, 6],
    [ck.CLOSE_VERB, 0]
  ])
  for (let index = 0; index < cmds.length;) {
    const verb = cmds[index]
    const count = counts.get(verb) ?? 0
    visit(verb, cmds.subarray(index + 1, index + 1 + count))
    index += 1 + count
  }
}

/** Appends `segment` to `builder`, running on from its last point when `continues`. */
function appendSegment(
  ck: CanvasKit,
  builder: PathBuilder,
  segment: Path,
  continues: boolean
): void {
  forEachVerb(ck, segment, (verb, a) => {
    if (verb === ck.MOVE_VERB) {
      if (!continues) builder.moveTo(a[0], a[1])
    } else if (verb === ck.LINE_VERB) builder.lineTo(a[0], a[1])
    else if (verb === ck.QUAD_VERB) builder.quadTo(a[0], a[1], a[2], a[3])
    else if (verb === ck.CONIC_VERB) builder.conicTo(a[0], a[1], a[2], a[3], a[4])
    else if (verb === ck.CUBIC_VERB) builder.cubicTo(a[0], a[1], a[2], a[3], a[4], a[5])
  })
  segment.delete()
}
