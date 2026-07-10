import type { Canvas, Paint } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph, Fill } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { geometryBlobToPath } from '#core/vector'

import { figmaBlendModeToSkia } from './blend'
import type { SkiaRenderer } from './renderer'
import { makeSmoothRRectPath, nodeHasSmoothCorners } from './shapes'

/**
 * Paint a VECTOR with per-path fills from fillGeometry (Figma styleOverrideTable).
 * Paths without path.fills use node.fills. Returns true when handled.
 */
export function drawVectorMultiStyleFills(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): boolean {
  if (node.type !== 'VECTOR' || node.fillGeometry.length === 0) return false
  const hasPathFills = node.fillGeometry.some((g) => g.fills && g.fills.length > 0)
  if (!hasPathFills) return false

  for (const g of node.fillGeometry) {
    const path = geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
    const fills = g.fills && g.fills.length > 0 ? g.fills : node.fills
    for (let fi = 0; fi < fills.length; fi++) {
      const fill = fills[fi]
      if (!fill.visible) continue
      if (!applyFill(r, fill, node, graph, fi)) continue
      r.fillPaint.setAlphaf(fill.opacity)
      r.fillPaint.setBlendMode(figmaBlendModeToSkia(r.ck, fill.blendMode))
      canvas.drawPath(path, r.fillPaint)
      r.fillPaint.setShader(null)
      r.fillPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    }
    path.delete()
  }
  return true
}

export function drawNodeFill(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  fill?: Fill
): void {
  switch (node.type) {
    case 'VECTOR': {
      // When path-level fills exist, multi-style drawing is handled separately.
      if (node.fillGeometry.some((g) => g.fills && g.fills.length > 0)) break
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
    case 'ELLIPSE': {
      const fg = r.getFillGeometry(node)
      if (fg) {
        for (const p of fg) canvas.drawPath(p, r.fillPaint)
      } else if (node.arcData) {
        r.drawArc(canvas, node, r.fillPaint)
      } else {
        canvas.drawOval(rect, r.fillPaint)
      }
      break
    }
    case 'TEXT':
      r.renderText(canvas, node, fill)
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
      if (nodeHasSmoothCorners(node)) {
        const path = makeSmoothRRectPath(r, node)
        canvas.drawPath(path, r.fillPaint)
        path.delete()
      } else if (hasRadius) {
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
  fillIndex = 0,
  patternStack = new Set<string>()
): boolean {
  r.fillPaint.setShader(null)

  if (fill.type === 'SOLID') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a))
    return true
  }

  if (fill.type.startsWith('GRADIENT') && fill.gradientStops && fill.gradientTransform) {
    r.applyGradientFill(fill, node, graph)
    return true
  }

  if (fill.type === 'IMAGE' && fill.imageHash) {
    return r.applyImageFill(fill, node, graph)
  }

  if (fill.type === 'PATTERN' && applyPatternFill(r, fill, node, graph, patternStack)) return true

  if (fill.type === 'PATTERN' || fill.type === 'NOISE' || fill.type === 'CUSTOM') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a))
    return true
  }

  return false
}

interface PatternTileLayout {
  rect: Rect
  scale: number
  positions: Vector[]
}

function patternAlignmentOffset(
  alignment: Fill['horizontalAlignment'],
  gap: number,
  sourceSize: number,
  axis: 'x' | 'y'
): number {
  if (alignment === 'CENTER') return axis === 'x' ? -gap / 2 : -sourceSize / 2
  if (alignment === 'END') return -gap
  return 0
}

export function patternTileLayout(source: SceneNode, fill: Fill): PatternTileLayout {
  const scale = fill.scale && fill.scale > 0 ? fill.scale : 1
  const spacing = fill.patternSpacing ?? { x: 0, y: 0 }
  const scaledWidth = source.width * scale
  const scaledHeight = source.height * scale
  const gapX = scaledWidth * spacing.x
  const gapY = scaledHeight * spacing.y
  const width = scaledWidth + gapX
  const height = scaledHeight + gapY
  const x = patternAlignmentOffset(fill.horizontalAlignment, gapX, scaledWidth, 'x')
  const y = patternAlignmentOffset(fill.verticalAlignment, gapY, scaledHeight, 'y')
  const positions = [{ x, y }]

  if (fill.patternTileType === 'HORIZONTAL_HEXAGONAL') {
    positions.push({ x: x + width / 2, y: y + height / 2 })
  } else if (fill.patternTileType === 'VERTICAL_HEXAGONAL') {
    positions.push({ x: x + width / 2, y: y - height / 2 })
  }

  return { rect: { x: 0, y: 0, width, height }, scale, positions }
}

function recordPatternSource(
  r: SkiaRenderer,
  source: SceneNode,
  graph: SceneGraph,
  layout: PatternTileLayout,
  patternStack: Set<string>
) {
  const bounds = r.ck.LTRBRect(0, 0, layout.rect.width, layout.rect.height)
  const recorder = new r.ck.PictureRecorder()
  const canvas = recorder.beginRecording(bounds)
  const rect = r.ck.LTRBRect(0, 0, source.width, source.height)
  const hasRadius = nodeHasSmoothCorners(source) || source.cornerRadius > 0

  for (const position of layout.positions) {
    canvas.save()
    canvas.translate(position.x, position.y)
    canvas.scale(layout.scale, layout.scale)
    for (const sourceFill of source.fills.filter((item) => item.visible)) {
      if (sourceFill.type === 'PATTERN' && sourceFill.sourceNodeId === source.id) continue
      if (!applyFill(r, sourceFill, source, graph, 0, patternStack)) continue
      drawNodeFill(r, canvas, source, rect, hasRadius, sourceFill)
    }
    canvas.restore()
  }

  const picture = recorder.finishRecordingAsPicture()
  recorder.delete()
  return picture
}

function resolvePatternSource(graph: SceneGraph, sourceId: string): SceneNode | null {
  const direct = graph.getNode(sourceId)
  if (direct) return direct
  for (const node of graph.getAllNodes()) {
    if (node.source.id === sourceId) return node
  }
  return null
}

function applyPatternFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  patternStack: Set<string>
): boolean {
  const sourceId = fill.sourceNodeId
  if (!sourceId || sourceId === node.id || sourceId === node.source.id) return false
  const source = resolvePatternSource(graph, sourceId)
  if (!source || source.width <= 0 || source.height <= 0) return false
  if (patternStack.has(source.id)) return false

  patternStack.add(source.id)
  const layout = patternTileLayout(source, fill)
  let picture
  try {
    picture = recordPatternSource(r, source, graph, layout, patternStack)
  } finally {
    patternStack.delete(source.id)
  }
  const tile = layout.rect
  const tileRect = r.ck.LTRBRect(tile.x, tile.y, tile.x + tile.width, tile.y + tile.height)
  const shader = picture.makeShader(
    r.ck.TileMode.Repeat,
    r.ck.TileMode.Repeat,
    r.ck.FilterMode.Linear,
    undefined,
    tileRect
  )
  r.fillPaint.setShader(shader)
  picture.delete()
  return true
}

function makeGradientLocalMatrix(
  r: SkiaRenderer,
  width: number,
  height: number,
  transform: NonNullable<Fill['gradientTransform']>
) {
  return r.ck.Matrix.multiply(r.ck.Matrix.scaled(width, height), [
    transform.m00,
    transform.m01,
    transform.m02,
    transform.m10,
    transform.m11,
    transform.m12,
    0,
    0,
    1
  ])
}

export function linearGradientEndpoints(
  width: number,
  height: number,
  transform: NonNullable<Fill['gradientTransform']>
) {
  return {
    start: {
      x: (transform.m00 + transform.m02) * width,
      y: (transform.m10 + transform.m12) * height
    },
    end: { x: transform.m02 * width, y: transform.m12 * height }
  }
}

export function applyGradientFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph
): void {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return
  const colors = stops.map((s, index) => {
    const resolved = r.resolveFillColorInfo(
      {
        ...fill,
        type: 'SOLID',
        color: s.color,
        opacity: s.color.a,
        visible: true
      },
      index,
      node,
      graph
    )
    const c = resolved.color
    return r.ck.Color4f(c.r, c.g, c.b, c.a)
  })
  const positions = stops.map((s) => s.position)

  const w = node.width
  const h = node.height

  if (fill.type === 'GRADIENT_LINEAR') {
    const { start, end } = linearGradientEndpoints(w, h, t)
    const startX = start.x
    const startY = start.y
    const endX = end.x
    const endY = end.y
    const shader = r.ck.Shader.MakeLinearGradient(
      [startX, startY],
      [endX, endY],
      colors,
      positions,
      r.ck.TileMode.Clamp
    )
    r.fillPaint.setShader(shader)
  } else if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    // Figma's gradientTransform maps gradient space (center 0.5,0.5, radius 0.5)
    // to the node's normalized [0,1] coordinate space. The full local matrix
    // converts to pixel coordinates: scale(w, h) * gradientTransform.
    const localMatrix = makeGradientLocalMatrix(r, w, h, t)
    const shader = r.ck.Shader.MakeRadialGradient(
      [0.5, 0.5],
      0.5,
      colors,
      positions,
      r.ck.TileMode.Clamp,
      localMatrix
    )
    r.fillPaint.setShader(shader)
  } else if (fill.type === 'GRADIENT_ANGULAR') {
    const localMatrix = makeGradientLocalMatrix(r, w, h, t)
    const shader = r.ck.Shader.MakeSweepGradient(
      0.5,
      0.5,
      colors,
      positions,
      r.ck.TileMode.Clamp,
      localMatrix
    )
    r.fillPaint.setShader(shader)
  }
}

export function makeImageFillLocalMatrix(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  imgW: number,
  imgH: number
) {
  const scaleMode = fill.imageScaleMode ?? 'FILL'
  if (scaleMode === 'TILE' && !fill.imageTransform) return r.ck.Matrix.identity()

  if ((scaleMode === 'CROP' || scaleMode === 'TILE') && fill.imageTransform) {
    const t = fill.imageTransform
    const transform = [t.m00, t.m01, t.m02, t.m10, t.m11, t.m12, 0, 0, 1]
    const inverse = r.ck.Matrix.invert(transform)
    if (inverse) {
      return r.ck.Matrix.multiply(
        r.ck.Matrix.scaled(node.width, node.height),
        inverse,
        r.ck.Matrix.scaled(1 / imgW, 1 / imgH)
      )
    }
  }

  let sx: number, sy: number, sw: number, sh: number
  if (scaleMode === 'FIT') {
    const scale = Math.min(node.width / imgW, node.height / imgH)
    sw = imgW
    sh = imgH
    sx = -(node.width / scale - imgW) / 2
    sy = -(node.height / scale - imgH) / 2
  } else {
    const scale = Math.max(node.width / imgW, node.height / imgH)
    sw = node.width / scale
    sh = node.height / scale
    sx = (imgW - sw) / 2
    sy = (imgH - sh) / 2
  }

  return r.ck.Matrix.multiply(
    r.ck.Matrix.scaled(node.width / sw, node.height / sh),
    r.ck.Matrix.translated(-sx, -sy)
  )
}

export function applyImageFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph
): boolean {
  const hash = fill.imageHash
  if (!hash) return false
  let img = r.imageCache.get(hash)
  if (!img) {
    const data = graph.images.get(hash)
    if (!data) return false
    const decoded = r.ck.MakeImageFromEncoded(data) ?? undefined
    if (!decoded) return false
    img = decoded.makeCopyWithDefaultMipmaps()
    decoded.delete()
    r.imageCache.set(hash, img)
  }

  const imgW = img.width()
  const imgH = img.height()
  const scaleMode = fill.imageScaleMode ?? 'FILL'

  const localMatrix = makeImageFillLocalMatrix(r, fill, node, imgW, imgH)

  if (scaleMode === 'TILE') {
    const shader = img.makeShaderCubic(
      r.ck.TileMode.Repeat,
      r.ck.TileMode.Repeat,
      1 / 3,
      1 / 3,
      localMatrix
    )
    r.fillPaint.setShader(shader)
    return true
  }

  const shader = img.makeShaderOptions(
    r.ck.TileMode.Clamp,
    r.ck.TileMode.Clamp,
    r.ck.FilterMode.Linear,
    r.ck.MipmapMode.Linear,
    localMatrix
  )
  r.fillPaint.setShader(shader)
  return true
}

export function makeArcPath(r: SkiaRenderer, node: SceneNode) {
  const arc = node.arcData
  if (!arc) return null
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
    return path
  }

  const isFullCircle = Math.abs(sweepDeg) >= 359.99
  if (isFullCircle) {
    path.addOval(oval)
  } else {
    path.moveTo(cx, cy)
    path.addArc(oval, startDeg, sweepDeg)
    path.close()
  }
  return path
}

export function drawArc(r: SkiaRenderer, canvas: Canvas, node: SceneNode, paint: Paint): void {
  const path = makeArcPath(r, node)
  if (!path) return
  canvas.drawPath(path, paint)
  path.delete()
}
