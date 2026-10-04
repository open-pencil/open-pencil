import type { Canvas, EmbindEnumEntity, Paint } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { ArrowEndpoint } from '@open-pencil/scene-graph/arrow-caps'
import { arrowLinesSegments, equilateralArrowPoints } from '@open-pencil/scene-graph/arrow-caps'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { applyGradientFill, applyImageFill } from './fills'
import type { SkiaRenderer } from './renderer'
import { makeSmoothRRectPath, nodeHasSmoothCorners } from './shapes'

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
    if (endpoint.cap === 'ARROW_EQUILATERAL') {
      const [tip, left, right] = equilateralArrowPoints(
        endpoint.x,
        endpoint.y,
        endpoint.angle,
        weight
      )
      const builder = new r.ck.PathBuilder()
      builder.moveTo(tip.x, tip.y)
      builder.lineTo(left.x, left.y)
      builder.lineTo(right.x, right.y)
      builder.close()
      const path = builder.detachAndDelete()
      r.fillPaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
      r.fillPaint.setAlphaf(opacity)
      canvas.drawPath(path, r.fillPaint)
      path.delete()
    } else {
      r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
      r.strokePaint.setAlphaf(opacity)
      r.strokePaint.setStrokeWidth(weight)
      r.strokePaint.setStrokeCap(r.ck.StrokeCap.Butt)
      r.strokePaint.setPathEffect(null)
      for (const wing of arrowLinesSegments(endpoint.x, endpoint.y, endpoint.angle, weight)) {
        canvas.drawLine(wing.from.x, wing.from.y, wing.to.x, wing.to.y, r.strokePaint)
      }
    }
  }
}

/**
 * A gradient or image stroke paints through a shader, the way the same paint does as a fill.
 * Both paints get it: a vector stroke's outline and an arrowhead are filled shapes drawn with
 * `fillPaint`, so the shader has to be on whichever paint the draw helper reaches for.
 * Returns false for a solid stroke, which paints through the paint's color instead.
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
    for (const paint of [r.strokePaint, r.fillPaint]) {
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
      )
    }
    return true
  }
  if (stroke.type === 'IMAGE' && stroke.imageHash) {
    let applied = false
    for (const paint of [r.strokePaint, r.fillPaint]) {
      applied = applyImageFill(r, stroke, node, graph, paint) || applied
    }
    return applied
  }
  return false
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

export function drawNodeStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): void {
  switch (node.type) {
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) canvas.drawPath(vp, r.strokePaint)
      }
      break
    }
    case 'ELLIPSE': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.strokePaint)
      } else if (node.arcData) {
        r.drawArc(canvas, node, r.strokePaint)
      } else {
        canvas.drawOval(rect, r.strokePaint)
      }
      break
    }
    case 'POLYGON':
    case 'STAR': {
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, r.strokePaint)
      path.delete()
      break
    }
    default:
      if (nodeHasSmoothCorners(node)) {
        const path = makeSmoothRRectPath(r, node)
        canvas.drawPath(path, r.strokePaint)
        path.delete()
      } else if (hasRadius) {
        canvas.drawRRect(r.makeRRect(node), r.strokePaint)
      } else {
        canvas.drawRect(rect, r.strokePaint)
      }
  }
}

export function drawStrokeWithAlign(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  if (align === 'INSIDE') {
    canvas.save()
    r.clipNodeShape(canvas, node, rect, hasRadius)
    const origWidth = r.strokePaint.getStrokeWidth()
    r.strokePaint.setStrokeWidth(origWidth * 2)
    r.drawNodeStroke(canvas, node, rect, hasRadius)
    r.strokePaint.setStrokeWidth(origWidth)
    canvas.restore()
  } else if (align === 'OUTSIDE') {
    canvas.save()
    const bigRect = r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2)
    const outerPath = new r.ck.PathBuilder()
    outerPath.addRect(bigRect)
    const innerPath = r.makeNodeShapePath(node, rect, hasRadius)
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
    r.drawNodeStroke(canvas, node, rect, hasRadius)
    r.strokePaint.setStrokeWidth(origWidth)
    canvas.restore()
  } else {
    r.drawNodeStroke(canvas, node, rect, hasRadius)
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
    drawStrokeWithAlign(
      r,
      canvas,
      node,
      r.ck.LTRBRect(0, 0, node.width, node.height),
      true,
      stroke.align
    )
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

export function drawIndividualSideStrokes(
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

export function strokeNodeShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paint: Paint
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)

  switch (node.type) {
    case 'ELLIPSE':
      canvas.drawOval(rect, paint)
      return
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) canvas.drawPath(vp, paint)
      }
      return
    }
    case 'LINE':
      canvas.drawLine(0, 0, node.width, node.height, paint)
      return
    case 'POLYGON':
    case 'STAR': {
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, paint)
      path.delete()
      return
    }
  }

  const hasRadius =
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))

  if (hasRadius) {
    if (node.independentCorners) {
      const rrect = new Float32Array([
        0,
        0,
        node.width,
        node.height,
        node.topLeftRadius,
        node.topLeftRadius,
        node.topRightRadius,
        node.topRightRadius,
        node.bottomRightRadius,
        node.bottomRightRadius,
        node.bottomLeftRadius,
        node.bottomLeftRadius
      ])
      canvas.drawRRect(rrect, paint)
    } else {
      canvas.drawRRect(r.ck.RRectXY(rect, node.cornerRadius, node.cornerRadius), paint)
    }
  } else {
    canvas.drawRect(rect, paint)
  }
}
