import type { SceneNode, SceneGraph, Fill } from '../scene-graph'
import type { Canvas, Paint } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

export function drawNodeFill(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): void {
  switch (node.type) {
    case 'VECTOR': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.fillPaint)
      } else {
        const vps = r.getVectorPaths(node)
        if (vps) {
          for (const vp of vps) canvas.drawPath(vp, r.fillPaint)
        }
      }
      break
    }
    case 'ELLIPSE':
      if (node.arcData) {
        r.drawArc(canvas, node, r.fillPaint)
      } else {
        canvas.drawOval(rect, r.fillPaint)
      }
      break
    case 'TEXT':
      r.renderText(canvas, node)
      break
    case 'LINE':
      canvas.drawLine(0, 0, node.width, node.height, r.fillPaint)
      break
    case 'POLYGON':
    case 'STAR': {
      const path = r.makePolygonPath(node)
      canvas.drawPath(path, r.fillPaint)
      path.delete()
      break
    }
    default:
      if (hasRadius) {
        canvas.drawRRect(r.makeRRect(node), r.fillPaint)
      } else {
        canvas.drawRect(rect, r.fillPaint)
      }
  }
}

export function applyFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  fillIndex = 0
): void {
  r.fillPaint.setShader(null)

  if (fill.type === 'SOLID') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a))
    return
  }

  if (fill.type.startsWith('GRADIENT') && fill.gradientStops && fill.gradientTransform) {
    r.applyGradientFill(fill, node)
    return
  }

  if (fill.type === 'IMAGE' && fill.imageHash) {
    r.applyImageFill(fill, node, graph)
    return
  }
}

export function applyGradientFill(r: SkiaRenderer, fill: Fill, node: SceneNode): void {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return
  const colors = stops.map((s) => r.ck.Color4f(s.color.r, s.color.g, s.color.b, s.color.a))
  const positions = stops.map((s) => s.position)

  const w = node.width
  const h = node.height

  if (fill.type === 'GRADIENT_LINEAR') {
    const startX = t.m02 * w
    const startY = t.m12 * h
    const endX = (t.m00 + t.m02) * w
    const endY = (t.m10 + t.m12) * h
    const shader = r.ck.Shader.MakeLinearGradient(
      [startX, startY],
      [endX, endY],
      colors,
      positions,
      r.ck.TileMode.Clamp
    )
    r.fillPaint.setShader(shader)
  } else if (fill.type === 'GRADIENT_RADIAL') {
    const cx = t.m02 * w
    const cy = t.m12 * h
    const radius = Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * Math.max(w, h)
    const shader = r.ck.Shader.MakeRadialGradient(
      [cx, cy],
      radius,
      colors,
      positions,
      r.ck.TileMode.Clamp
    )
    r.fillPaint.setShader(shader)
  } else if (fill.type === 'GRADIENT_ANGULAR') {
    const cx = t.m02 * w
    const cy = t.m12 * h
    const shader = r.ck.Shader.MakeSweepGradient(
      cx,
      cy,
      colors,
      positions,
      r.ck.TileMode.Clamp,
      undefined
    )
    r.fillPaint.setShader(shader)
  } else if (fill.type === 'GRADIENT_DIAMOND') {
    const cx = t.m02 * w
    const cy = t.m12 * h
    const radius = Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * Math.max(w, h)
    const shader = r.ck.Shader.MakeRadialGradient(
      [cx, cy],
      radius,
      colors,
      positions,
      r.ck.TileMode.Clamp
    )
    r.fillPaint.setShader(shader)
  }
}

export function applyImageFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph
): void {
  const hash = fill.imageHash
  if (!hash) return
  let img = r.imageCache.get(hash)
  if (!img) {
    const data = graph.images.get(hash)
    if (!data) return
    img = r.ck.MakeImageFromEncoded(data) ?? undefined
    if (img) r.imageCache.set(hash, img)
    else return
  }

  const imgW = img.width()
  const imgH = img.height()
  const scaleMode = fill.imageScaleMode ?? 'FILL'

  let sx: number, sy: number, sw: number, sh: number
  if (scaleMode === 'FILL') {
    const scale = Math.max(node.width / imgW, node.height / imgH)
    sw = node.width / scale
    sh = node.height / scale
    sx = (imgW - sw) / 2
    sy = (imgH - sh) / 2
  } else if (scaleMode === 'FIT') {
    sw = imgW
    sh = imgH
    sx = 0
    sy = 0
  } else {
    sx = 0
    sy = 0
    sw = imgW
    sh = imgH
  }

  const shader = img.makeShaderCubic(
    r.ck.TileMode.Clamp,
    r.ck.TileMode.Clamp,
    1 / 3,
    1 / 3,
    r.ck.Matrix.multiply(
      r.ck.Matrix.scaled(node.width / sw, node.height / sh),
      r.ck.Matrix.translated(-sx, -sy)
    )
  )
  r.fillPaint.setShader(shader)
}

export function drawArc(r: SkiaRenderer, canvas: Canvas, node: SceneNode, paint: Paint): void {
  const arc = node.arcData
  if (!arc) return
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const innerRx = rx * arc.innerRadius
  const innerRy = ry * arc.innerRadius

  const startDeg = arc.startingAngle * (180 / Math.PI)
  const endDeg = arc.endingAngle * (180 / Math.PI)
  const sweepDeg = endDeg - startDeg

  const path = new r.ck.Path()
  const oval = r.ck.LTRBRect(0, 0, node.width, node.height)

  if (arc.innerRadius > 0) {
    path.addArc(oval, startDeg, sweepDeg)
    const innerOval = r.ck.LTRBRect(cx - innerRx, cy - innerRy, cx + innerRx, cy + innerRy)
    const innerPath = new r.ck.Path()
    innerPath.addArc(innerOval, startDeg + sweepDeg, -sweepDeg)
    path.addPath(innerPath)
    path.close()
    innerPath.delete()
  } else {
    const isFullCircle = Math.abs(sweepDeg) >= 359.99
    if (isFullCircle) {
      path.addOval(oval)
    } else {
      path.moveTo(cx, cy)
      path.addArc(oval, startDeg, sweepDeg)
      path.close()
    }
  }

  canvas.drawPath(path, paint)
  path.delete()
}
