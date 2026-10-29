import type { Canvas, EmbindEnumEntity, Paint, Path } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { ArrowEndpoint, ArrowWing } from '@open-pencil/scene-graph/arrow-caps'
import {
  arrowLinesSegments,
  circleCapRadius,
  diamondCapPoints,
  equilateralArrowPoints,
  triangleCapPoints
} from '@open-pencil/scene-graph/arrow-caps'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { applyGradientFill, applyImageFill } from './fills'
import type { SkiaRenderer } from './renderer'
import {
  drawOutline,
  makeShapeWithTextDetailsPath,
  nodeHasSmoothCorners,
  withNodeOutline
} from './shapes'

export function getStrokeCapEntity(r: SkiaRenderer, cap: string | undefined): EmbindEnumEntity {
  switch (cap) {
    case 'ROUND':
      return r.ck.StrokeCap.Round
    case 'SQUARE':
      return r.ck.StrokeCap.Square
    default:
      return r.ck.StrokeCap.Butt
  }
}

export function getStrokeJoinEntity(r: SkiaRenderer, join: string | undefined): EmbindEnumEntity {
  switch (join) {
    case 'ROUND':
      return r.ck.StrokeJoin.Round
    case 'BEVEL':
      return r.ck.StrokeJoin.Bevel
    default:
      return r.ck.StrokeJoin.Miter
  }
}

export function normalizeDashPattern(dash: readonly number[] | undefined): number[] {
  if (!dash || dash.length === 0) return []
  // Figma permits odd-length alternating patterns; CanvasKit requires the
  // on/off interval list to contain a pair for every cycle.
  return dash.length % 2 === 0 ? [...dash] : [...dash, ...dash]
}

function strokeInset(stroke: Stroke): number {
  if (stroke.align === 'INSIDE') return stroke.weight / 2
  if (stroke.align === 'OUTSIDE') return -stroke.weight / 2
  return 0
}

export function drawDashedRRectWithSolidCorners(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: Stroke,
  color: Color,
  cornerRadius: number,
  dashPhase = 0
): void {
  const dash = normalizeDashPattern(stroke.dashPattern)
  const inset = strokeInset(stroke)
  const left = inset
  const top = inset
  const right = node.width - inset
  const bottom = node.height - inset
  const radius = Math.max(0, cornerRadius - inset)

  r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  r.strokePaint.setStrokeWidth(stroke.weight)
  r.strokePaint.setAlphaf(stroke.opacity)
  r.strokePaint.setStrokeCap(r.ck.StrokeCap.Butt)
  r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join ?? node.strokeJoin))
  r.strokePaint.setStrokeMiter(node.strokeMiterLimit)
  r.strokePaint.setPathEffect(null)

  canvas.drawArc(
    r.ck.LTRBRect(left, top, left + radius * 2, top + radius * 2),
    180,
    90,
    false,
    r.strokePaint
  )
  canvas.drawArc(
    r.ck.LTRBRect(right - radius * 2, top, right, top + radius * 2),
    270,
    90,
    false,
    r.strokePaint
  )
  canvas.drawArc(
    r.ck.LTRBRect(right - radius * 2, bottom - radius * 2, right, bottom),
    0,
    90,
    false,
    r.strokePaint
  )
  canvas.drawArc(
    r.ck.LTRBRect(left, bottom - radius * 2, left + radius * 2, bottom),
    90,
    90,
    false,
    r.strokePaint
  )

  r.strokePaint.setPathEffect(dash.length > 0 ? r.ck.PathEffect.MakeDash(dash, dashPhase) : null)
  canvas.drawLine(left + radius, top, right - radius, top, r.strokePaint)
  canvas.drawLine(right, top + radius, right, bottom - radius, r.strokePaint)
  canvas.drawLine(right - radius, bottom, left + radius, bottom, r.strokePaint)
  canvas.drawLine(left, bottom - radius, left, top + radius, r.strokePaint)
  r.strokePaint.setPathEffect(null)
}

/** The outline a polygonal head fills: a triangle, an equilateral arrow, or a diamond. */
function polygonPath(r: SkiaRenderer, points: readonly Vector[]): Path {
  const builder = new r.ck.PathBuilder()
  points.forEach((point, index) =>
    index === 0 ? builder.moveTo(point.x, point.y) : builder.lineTo(point.x, point.y)
  )
  builder.close()
  return builder.detachAndDelete()
}

/** The corners of each head drawn as a polygon, from its tip, direction, and weight. */
const POLYGON_HEADS = {
  ARROW_EQUILATERAL: equilateralArrowPoints,
  TRIANGLE_FILLED: triangleCapPoints,
  DIAMOND_FILLED: diamondCapPoints
} satisfies Record<string, (x: number, y: number, angle: number, weight: number) => Vector[]>

/**
 * The filled outline of the head at `endpoint`. A line arrow's wings are one stroked path, so they
 * meet in a round join rather than overlapping at the tip.
 */
export function arrowHeadPath(
  r: SkiaRenderer,
  endpoint: ArrowEndpoint,
  weight: number
): Path | null {
  const { x, y, angle, cap } = endpoint
  if (cap === 'ARROW_LINES') {
    const [first, second] = arrowLinesSegments(x, y, angle, weight)
    const builder = new r.ck.PathBuilder()
    builder.moveTo(first.to.x, first.to.y)
    builder.lineTo(first.from.x, first.from.y)
    builder.lineTo(second.to.x, second.to.y)
    const wings = builder.detachAndDelete()
    const outline = wings.makeStroked({
      width: weight,
      cap: r.ck.StrokeCap.Round,
      join: r.ck.StrokeJoin.Round
    })
    wings.delete()
    return outline
  }
  if (cap === 'CIRCLE_FILLED') {
    const builder = new r.ck.PathBuilder()
    builder.addCircle(x, y, circleCapRadius(weight))
    return builder.detachAndDelete()
  }
  return polygonPath(r, POLYGON_HEADS[cap](x, y, angle, weight))
}

/**
 * Draws arrow heads at open path endpoints in the stroke's color. The shaft
 * is expected to be drawn separately; heads overlay its terminal segment.
 */
export function drawArrowHeads(
  r: SkiaRenderer,
  canvas: Canvas,
  endpoints: ArrowEndpoint[],
  weight: number,
  color: Color,
  opacity: number
): void {
  for (const endpoint of endpoints) {
    const { x, y, angle } = endpoint
    switch (endpoint.cap) {
      case 'ARROW_LINES':
        r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
        r.strokePaint.setAlphaf(opacity)
        r.strokePaint.setStrokeWidth(weight)
        // One path, so the wings meet in a round join rather than overlapping at the tip.
        r.strokePaint.setStrokeCap(r.ck.StrokeCap.Round)
        r.strokePaint.setStrokeJoin(r.ck.StrokeJoin.Round)
        r.strokePaint.setPathEffect(null)
        strokeWings(r, canvas, arrowLinesSegments(x, y, angle, weight))
        break
      case 'CIRCLE_FILLED':
        setHeadPaint(r, color, opacity)
        canvas.drawCircle(x, y, circleCapRadius(weight), r.fillPaint)
        break
      case 'ARROW_EQUILATERAL':
        fillHead(r, canvas, equilateralArrowPoints(x, y, angle, weight), color, opacity)
        break
      case 'TRIANGLE_FILLED':
        fillHead(r, canvas, triangleCapPoints(x, y, angle, weight), color, opacity)
        break
      case 'DIAMOND_FILLED':
        fillHead(r, canvas, diamondCapPoints(x, y, angle, weight), color, opacity)
        break
    }
  }
}

function strokeWings(r: SkiaRenderer, canvas: Canvas, [first, second]: [ArrowWing, ArrowWing]) {
  const builder = new r.ck.PathBuilder()
  builder.moveTo(first.to.x, first.to.y)
  builder.lineTo(first.from.x, first.from.y)
  builder.lineTo(second.to.x, second.to.y)
  const path = builder.detachAndDelete()
  canvas.drawPath(path, r.strokePaint)
  path.delete()
}

function setHeadPaint(r: SkiaRenderer, color: Color, opacity: number) {
  r.fillPaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  r.fillPaint.setAlphaf(opacity)
}

/** Fills a head outlined by `points` in the stroke's colour. */
function fillHead(
  r: SkiaRenderer,
  canvas: Canvas,
  points: readonly Vector[],
  color: Color,
  opacity: number
) {
  const path = polygonPath(r, points)
  setHeadPaint(r, color, opacity)
  canvas.drawPath(path, r.fillPaint)
  path.delete()
}

/**
 * A gradient or image stroke paints through a shader, the way the same paint does as a fill.
 * Both paints get it: a vector stroke's outline and an arrowhead are filled shapes drawn with
 * `fillPaint`, so the shader has to be on whichever paint the draw helper reaches for.
 * Returns whether the stroke draws: a solid one paints through the paint's color, while a gradient
 * CanvasKit cannot build, as for a transform that holds no numbers, or an image not yet decoded is
 * skipped rather than drawn in that color, the way a fill is.
 */
export function applyStrokeShader(
  r: SkiaRenderer,
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph
): boolean {
  r.strokePaint.setShader(null)
  r.fillPaint.setShader(null)
  if (stroke.type.startsWith('GRADIENT') && stroke.gradientStops && stroke.gradientTransform) {
    let built = true
    for (const paint of [r.strokePaint, r.fillPaint]) {
      built =
        applyGradientFill(
          r,
          stroke,
          node,
          graph,
          paint,
          // Every stop resolves against this stroke's own binding, not the stop's position.
          (color) =>
            r.resolveStrokeColorInfo(
              { ...stroke, type: 'SOLID', color, opacity: color.a, visible: true },
              strokeIndex,
              node,
              graph
            ).color
        ) && built
    }
    return built
  }
  if (stroke.type === 'IMAGE' && stroke.imageHash) {
    let applied = true
    for (const paint of [r.strokePaint, r.fillPaint]) {
      applied = applyImageFill(r, stroke, node, graph, paint) && applied
    }
    return applied
  }
  return true
}

/** Leaves any shader in place: a shaded stroke's color is unused, but its alpha still applies. */
export function configureStrokePaint(
  r: SkiaRenderer,
  node: SceneNode,
  stroke: Stroke,
  color: Color
): void {
  r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  r.strokePaint.setStrokeWidth(stroke.weight)
  r.strokePaint.setAlphaf(stroke.opacity)
  r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap ?? node.strokeCap))
  r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join ?? node.strokeJoin))
  r.strokePaint.setStrokeMiter(node.strokeMiterLimit)
}

export function drawStyledRRectStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  rrect: Float32Array,
  node: SceneNode,
  stroke: Stroke,
  color: Color,
  dashPhase = 0
): void {
  const dash = normalizeDashPattern(stroke.dashPattern)
  configureStrokePaint(r, node, stroke, color)
  r.strokePaint.setPathEffect(dash.length > 0 ? r.ck.PathEffect.MakeDash(dash, dashPhase) : null)
  r.drawRRectStrokeWithAlign(canvas, rrect, node, stroke)
  r.strokePaint.setPathEffect(null)
}

/** Strokes a layer's outline, or a vector's own paths, open ones included. */
export function drawNodeStroke(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  strokeNodeShape(r, canvas, node, r.strokePaint)
}

export function drawStrokeWithAlign(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  if (align === 'INSIDE') {
    canvas.save()
    r.clipNodeShape(canvas, node)
    const origWidth = r.strokePaint.getStrokeWidth()
    r.strokePaint.setStrokeWidth(origWidth * 2)
    r.drawNodeStroke(canvas, node)
    r.strokePaint.setStrokeWidth(origWidth)
    canvas.restore()
  } else if (align === 'OUTSIDE') {
    canvas.save()
    const bigRect = r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2)
    const outerPath = new r.ck.PathBuilder()
    outerPath.addRect(bigRect)
    const innerPath = r.makeNodeShapePath(node)
    const immutableOuterPath = outerPath.detachAndDelete()
    const clipPath = r.ck.Path.MakeFromOp(immutableOuterPath, innerPath, r.ck.PathOp.Difference)
    immutableOuterPath.delete()
    innerPath.delete()
    if (!clipPath) {
      canvas.restore()
      return
    }
    canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
    clipPath.delete()
    const origWidth = r.strokePaint.getStrokeWidth()
    r.strokePaint.setStrokeWidth(origWidth * 2)
    r.drawNodeStroke(canvas, node)
    r.strokePaint.setStrokeWidth(origWidth)
    canvas.restore()
  } else {
    r.drawNodeStroke(canvas, node)
  }
  // Inner lines, such as a database's front rim, lie inside the outline: they keep the stroke's
  // own weight whatever its alignment, and end where the outline does.
  const details = makeShapeWithTextDetailsPath(r, node)
  if (details) {
    canvas.save()
    r.clipNodeShape(canvas, node)
    canvas.drawPath(details, r.strokePaint)
    canvas.restore()
    details.delete()
  }
}

export function drawRRectStrokeWithAlign(
  r: SkiaRenderer,
  canvas: Canvas,
  rrect: Float32Array,
  node: SceneNode,
  stroke: Stroke
): void {
  if (nodeHasSmoothCorners(node)) {
    drawStrokeWithAlign(r, canvas, node, stroke.align)
    return
  }

  if (stroke.align === 'INSIDE') {
    canvas.save()
    canvas.clipRRect(rrect, r.ck.ClipOp.Intersect, true)
    r.strokePaint.setStrokeWidth(stroke.weight * 2)
    canvas.drawRRect(rrect, r.strokePaint)
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.restore()
  } else if (stroke.align === 'OUTSIDE') {
    canvas.save()
    const outerPath = new r.ck.PathBuilder()
    outerPath.addRect(r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2))
    const innerPath = new r.ck.PathBuilder()
    innerPath.addRRect(rrect)
    const immutableOuterPath = outerPath.detachAndDelete()
    const immutableInnerPath = innerPath.detachAndDelete()
    const clipPath = r.ck.Path.MakeFromOp(
      immutableOuterPath,
      immutableInnerPath,
      r.ck.PathOp.Difference
    )
    immutableOuterPath.delete()
    immutableInnerPath.delete()
    if (!clipPath) {
      canvas.restore()
      return
    }
    canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
    clipPath.delete()
    r.strokePaint.setStrokeWidth(stroke.weight * 2)
    canvas.drawRRect(rrect, r.strokePaint)
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.restore()
  } else {
    canvas.drawRRect(rrect, r.strokePaint)
  }
}

/** Strokes a layer's outline with `paint`: a vector's own paths, open ones included, and a line. */
export function strokeNodeShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paint: Paint
): void {
  if (node.type === 'VECTOR') {
    for (const path of r.getVectorPaths(node) ?? []) canvas.drawPath(path, paint)
  } else if (node.type === 'LINE') {
    canvas.drawLine(0, 0, node.width, node.height, paint)
  } else {
    withNodeOutline(r, node, (outline) => drawOutline(canvas, outline, paint))
  }
}
