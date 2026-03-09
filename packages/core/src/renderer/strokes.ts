import type { SceneNode, Stroke } from '../scene-graph'
import type { Canvas, Paint } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

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
    case 'ELLIPSE':
      if (node.arcData) {
        r.drawArc(canvas, node, r.strokePaint)
      } else {
        canvas.drawOval(rect, r.strokePaint)
      }
      break
    case 'POLYGON':
    case 'STAR': {
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, r.strokePaint)
      path.delete()
      break
    }
    default:
      if (hasRadius) {
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
    const bigRect = r.ck.LTRBRect(
      -node.width,
      -node.height,
      node.width * 2,
      node.height * 2
    )
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
    canvas.save()
    canvas.clipRRect(rrect, r.ck.ClipOp.Intersect, true)
    r.strokePaint.setStrokeWidth(stroke.weight * 2)
    canvas.drawRRect(rrect, r.strokePaint)
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.restore()
  } else if (stroke.align === 'OUTSIDE') {
    canvas.save()
    const outerPath = new r.ck.Path()
    outerPath.addRect(
      r.ck.LTRBRect(-node.width, -node.height, node.width * 2, node.height * 2)
    )
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
    const y = inside ? tw / 2 : (outside ? -tw / 2 : 0)
    r.strokePaint.setStrokeWidth(tw)
    canvas.drawLine(0, y, w, y, r.strokePaint)
  }

  const rw = node.borderRightWeight
  if (rw > 0) {
    const x = inside ? w - rw / 2 : (outside ? w + rw / 2 : w)
    r.strokePaint.setStrokeWidth(rw)
    canvas.drawLine(x, 0, x, h, r.strokePaint)
  }

  const bw = node.borderBottomWeight
  if (bw > 0) {
    const y = inside ? h - bw / 2 : (outside ? h + bw / 2 : h)
    r.strokePaint.setStrokeWidth(bw)
    canvas.drawLine(0, y, w, y, r.strokePaint)
  }

  const lw = node.borderLeftWeight
  if (lw > 0) {
    const x = inside ? lw / 2 : (outside ? -lw / 2 : 0)
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
