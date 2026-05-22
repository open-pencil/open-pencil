import type { Canvas, EmbindEnumEntity, Paint } from 'canvaskit-wasm'

import type { SceneNode, Stroke } from '#core/scene-graph'
import type { Color } from '#core/types'

import { hasValidDimensions, hasValidLineDimensions } from './fills'
import type { SkiaRenderer } from './renderer'
import { nodeHasRadius } from './shapes'

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
  const dash = stroke.dashPattern ?? []
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
  r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join))
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

  const dashEffect = dash.length > 0 ? r.ck.PathEffect.MakeDash(dash, dashPhase) : null
  try {
    r.strokePaint.setPathEffect(dashEffect)
    canvas.drawLine(left + radius, top, right - radius, top, r.strokePaint)
    canvas.drawLine(right, top + radius, right, bottom - radius, r.strokePaint)
    canvas.drawLine(right - radius, bottom, left + radius, bottom, r.strokePaint)
    canvas.drawLine(left, bottom - radius, left, top + radius, r.strokePaint)
  } finally {
    try {
      r.strokePaint.setPathEffect(null)
    } finally {
      dashEffect?.delete()
    }
  }
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
  const dash = stroke.dashPattern ?? []
  r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  r.strokePaint.setStrokeWidth(stroke.weight)
  r.strokePaint.setAlphaf(stroke.opacity)
  r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap))
  r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join))
  const dashEffect = dash.length > 0 ? r.ck.PathEffect.MakeDash(dash, dashPhase) : null
  try {
    r.strokePaint.setPathEffect(dashEffect)
    r.drawRRectStrokeWithAlign(canvas, rrect, node, stroke)
  } finally {
    try {
      r.strokePaint.setPathEffect(null)
    } finally {
      dashEffect?.delete()
    }
  }
}

export function drawNodeStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): void {
  // Guard dimension-dependent stroke operations against NaN/Infinity.
  // VECTOR and TEXT nodes don't depend on width/height for stroke rendering,
  // so they are allowed through even with degenerate dimensions.
  const dimsValid = hasValidDimensions(node.width, node.height)
  const lineValid = hasValidLineDimensions(node.width, node.height)

  switch (node.type) {
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) canvas.drawPath(vp, r.strokePaint)
      }
      break
    }
    case 'TEXT':
      break
    case 'ELLIPSE': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.strokePaint)
      } else if (node.arcData) {
        r.drawArc(canvas, node, r.strokePaint)
      } else if (dimsValid) {
        canvas.drawOval(rect, r.strokePaint)
      }
      break
    }
    case 'LINE':
      if (lineValid) {
        canvas.drawLine(0, 0, node.width, node.height, r.strokePaint)
      }
      break
    case 'POLYGON':
    case 'STAR': {
      if (!dimsValid) break
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, r.strokePaint)
      path.delete()
      break
    }
    default:
      if (dimsValid) {
        if (hasRadius) {
          canvas.drawRRect(r.makeRRect(node), r.strokePaint)
        } else {
          canvas.drawRect(rect, r.strokePaint)
        }
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
    // Guard INSIDE stroke alignment — clipNodeShape receives rect constructed
    // from node dimensions, and a NaN-bearing clip corrupts canvas state.
    if (!hasValidDimensions(node.width, node.height)) return
    canvas.save()
    r.clipNodeShape(canvas, node, rect, hasRadius)
    const origWidth = r.strokePaint.getStrokeWidth()
    r.strokePaint.setStrokeWidth(origWidth * 2)
    r.drawNodeStroke(canvas, node, rect, hasRadius)
    r.strokePaint.setStrokeWidth(origWidth)
    canvas.restore()
  } else if (align === 'OUTSIDE') {
    // Guard OUTSIDE stroke alignment against NaN/Infinity dimensions.
    // The bigRect calculation uses node.width/height directly — NaN would
    // produce degenerate clip paths and corrupt CanvasKit Path operations.
    if (!hasValidDimensions(node.width, node.height)) return
    canvas.save()
    const bigRect = r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2)
    const outerPath = new r.ck.Path()
    outerPath.addRect(bigRect)
    const innerPath = r.makeNodeShapePath(node, rect, hasRadius)
    outerPath.op(innerPath, r.ck.PathOp.Difference)
    innerPath.delete()
    canvas.clipPath(outerPath, r.ck.ClipOp.Intersect, true)
    outerPath.delete()
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
  if (stroke.align === 'INSIDE') {
    if (!hasValidDimensions(node.width, node.height)) return
    canvas.save()
    canvas.clipRRect(rrect, r.ck.ClipOp.Intersect, true)
    r.strokePaint.setStrokeWidth(stroke.weight * 2)
    canvas.drawRRect(rrect, r.strokePaint)
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.restore()
  } else if (stroke.align === 'OUTSIDE') {
    if (!hasValidDimensions(node.width, node.height)) return
    canvas.save()
    const outerPath = new r.ck.Path()
    outerPath.addRect(r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2))
    const innerPath = new r.ck.Path()
    innerPath.addRRect(rrect)
    outerPath.op(innerPath, r.ck.PathOp.Difference)
    innerPath.delete()
    canvas.clipPath(outerPath, r.ck.ClipOp.Intersect, true)
    outerPath.delete()
    r.strokePaint.setStrokeWidth(stroke.weight * 2)
    canvas.drawRRect(rrect, r.strokePaint)
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.restore()
  } else {
    // CENTER alignment — guard against degenerate dimensions in rrect
    if (hasValidDimensions(node.width, node.height)) {
      canvas.drawRRect(rrect, r.strokePaint)
    }
  }
}

export function drawIndividualSideStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  if (!hasValidDimensions(node.width, node.height)) return
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
  // VECTOR nodes use pre-computed vector paths, not node dimensions.
  // Exempt them from the dimension guard.
  const dimsValid = hasValidDimensions(node.width, node.height)
  const lineValid = hasValidLineDimensions(node.width, node.height)

  switch (node.type) {
    case 'ELLIPSE':
      if (node.arcData) {
        r.drawArc(canvas, node, paint)
      } else if (dimsValid) {
        const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
        canvas.drawOval(rect, paint)
      }
      return
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) canvas.drawPath(vp, paint)
      }
      return
    }
    case 'LINE':
      if (lineValid) canvas.drawLine(0, 0, node.width, node.height, paint)
      return
    case 'POLYGON':
    case 'STAR': {
      if (!dimsValid) return
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, paint)
      path.delete()
      return
    }
  }

  // Default: rect/RRect — guard against invalid dimensions
  if (!dimsValid) return
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)

  if (nodeHasRadius(node)) {
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
