import type { Canvas, Path } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { getStrokeCapEntity, getStrokeJoinEntity } from '#core/canvas/strokes'
import type { SceneNode } from '#core/scene-graph'
import type { Color } from '#core/types'

export function drawVectorStrokeGeometry(
  r: SkiaRenderer,
  canvas: Canvas,
  sg: Path[],
  sc: Color,
  opacity: number
): void {
  r.fillPaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.fillPaint.setAlphaf(opacity)
  r.fillPaint.setShader(null)
  for (const p of sg) canvas.drawPath(p, r.fillPaint)
}

export function vectorStrokePaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.vectorStrokePathCache.get(node.id)
  if (cached) return cached

  const paths: Path[] = []
  for (const segment of node.vectorNetwork.segments) {
    const start = node.vectorNetwork.vertices[segment.start]
    const end = node.vectorNetwork.vertices[segment.end]

    const path = new r.ck.Path()
    path.moveTo(start.x, start.y)
    const isStraight =
      Math.abs(segment.tangentStart.x) < 0.001 &&
      Math.abs(segment.tangentStart.y) < 0.001 &&
      Math.abs(segment.tangentEnd.x) < 0.001 &&
      Math.abs(segment.tangentEnd.y) < 0.001
    if (isStraight) {
      path.lineTo(end.x, end.y)
    } else {
      path.cubicTo(
        start.x + segment.tangentStart.x,
        start.y + segment.tangentStart.y,
        end.x + segment.tangentEnd.x,
        end.y + segment.tangentEnd.y,
        end.x,
        end.y
      )
    }
    paths.push(path)
  }

  if (paths.length === 0) return null
  r.vectorStrokePathCache.set(node.id, paths)
  return paths
}

export function drawVectorPathStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  vectorPaths: Path[],
  stroke: SceneNode['strokes'][0],
  sc: Color,
  outlineCacheKey?: string
): void {
  const dash = stroke.dashPattern
  if (dash && dash.length > 0) {
    r.strokePaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
    r.strokePaint.setAlphaf(stroke.opacity)
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap ?? 'NONE'))
    r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join ?? 'MITER'))
    r.strokePaint.setShader(null)
    const effect = r.ck.PathEffect.MakeDash(dash, 0)
    try {
      r.strokePaint.setPathEffect(effect)
      for (const vp of vectorPaths) canvas.drawPath(vp, r.strokePaint)
    } finally {
      try {
        r.strokePaint.setPathEffect(null)
      } finally {
        effect.delete()
      }
    }
    return
  }
  const strokeOpts = {
    width: stroke.weight,
    miter_limit: 4,
    cap: getStrokeCapEntity(r, stroke.cap ?? 'NONE'),
    join: getStrokeJoinEntity(r, stroke.join ?? 'MITER')
  }
  r.fillPaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.fillPaint.setAlphaf(stroke.opacity)
  r.fillPaint.setShader(null)

  let outlines = outlineCacheKey ? r.vectorStrokeOutlineCache.get(outlineCacheKey) : undefined
  if (!outlines) {
    outlines = []
    for (const vp of vectorPaths) {
      const copy = vp.copy()
      const outline = copy.stroke(strokeOpts)
      if (outline) {
        outlines.push(outline)
      } else {
        // .stroke() failed — delete the orphaned copy to prevent WASM leak
        copy.delete()
      }
    }
    if (outlineCacheKey) r.vectorStrokeOutlineCache.set(outlineCacheKey, outlines)
  }
  try {
    for (const outline of outlines) canvas.drawPath(outline, r.fillPaint)
  } finally {
    // When not cached, we own the WASM Path lifecycle — delete after drawing.
    // When cached, the cache owns the lifecycle and will delete on eviction/clear.
    if (!outlineCacheKey) {
      for (const outline of outlines) outline.delete()
    }
  }
}

export function drawRegularStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  stroke: SceneNode['strokes'][0],
  sc: Color
): void {
  r.strokePaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.strokePaint.setStrokeWidth(stroke.weight)
  r.strokePaint.setAlphaf(stroke.opacity)

  if (stroke.cap) {
    r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap))
  }
  if (stroke.join) {
    r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join))
  }
  if (stroke.dashPattern && stroke.dashPattern.length > 0) {
    // CanvasKit PathEffect is a native WASM object that must be freed to prevent
    // memory leaks. Nested try/finally ensures cleanup even if setPathEffect(null)
    // throws, preventing both the WASM leak and stale dash-pattern pollution.
    const effect = r.ck.PathEffect.MakeDash(stroke.dashPattern, 0)
    try {
      r.strokePaint.setPathEffect(effect)
      drawRegularStrokeBody(r, canvas, node, rect, hasRadius, stroke)
    } finally {
      try {
        r.strokePaint.setPathEffect(null)
      } finally {
        effect.delete()
      }
    }
  } else {
    r.strokePaint.setPathEffect(null)
    drawRegularStrokeBody(r, canvas, node, rect, hasRadius, stroke)
  }
}

function drawRegularStrokeBody(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  stroke: SceneNode['strokes'][0]
): void {
  if (node.independentStrokeWeights && r.isRectangularType(node.type)) {
    r.drawIndividualSideStrokes(canvas, node, stroke.align)
  } else {
    r.drawStrokeWithAlign(canvas, node, rect, hasRadius, stroke.align)
  }
}

export function drawNodeStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  stroke: SceneNode['strokes'][0],
  sc: Color,
  sg: Path[] | null,
  vectorPaths: Path[] | null,
  vectorStroke: Path[] | null
): void {
  const shouldStrokeVectorCenterline =
    vectorStroke &&
    stroke.align === 'CENTER' &&
    node.cornerRadius === 0 &&
    node.type === 'VECTOR' &&
    !node.fills.some((fill) => fill.visible)
  if (shouldStrokeVectorCenterline) {
    const outlineKey = `${node.id}|${stroke.weight}|${stroke.cap ?? 'NONE'}|${stroke.join ?? 'MITER'}`
    drawVectorPathStrokes(r, canvas, vectorStroke, stroke, sc, outlineKey)
    return
  }
  if (!sg) {
    if (vectorPaths) drawVectorPathStrokes(r, canvas, vectorPaths, stroke, sc)
    else drawRegularStroke(r, canvas, node, rect, hasRadius, stroke, sc)
    return
  }
  if (stroke.align !== 'INSIDE') {
    drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    return
  }

  const clipPaths = node.type === 'VECTOR' ? r.getFillGeometry(node) : null
  if (node.type === 'VECTOR' && !clipPaths) {
    drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    return
  }

  canvas.save()
  if (clipPaths) {
    for (const path of clipPaths) canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
  } else {
    r.clipNodeShape(canvas, node, rect, hasRadius)
  }
  drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
  canvas.restore()
}
