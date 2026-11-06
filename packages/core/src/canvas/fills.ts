import type { Canvas, Image, Paint, Shader } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph, Fill } from '@open-pencil/scene-graph'
import { invertGradientTransform } from '@open-pencil/scene-graph/gradient'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import { fillGeometryMatchesRegions, hasRegionFills } from '@open-pencil/scene-graph/vector-network'

import { setPaintBlendMode } from './blend'
import { makeDiamondGradient } from './gradients/diamond'
import { previewEdge } from './images/previews'
import type { SkiaRenderer } from './renderer'
import { drawOutline, withNodeOutline } from './shapes'

interface PaintFillsOptions {
  readonly bindToNodeFills?: boolean
  readonly patternStack?: Set<string>
}

export function paintFills(
  r: SkiaRenderer,
  fills: readonly Fill[],
  node: SceneNode,
  graph: SceneGraph,
  draw: (fill: Fill) => void,
  options: PaintFillsOptions = {}
): void {
  for (let index = 0; index < fills.length; index++) {
    const fill = fills[index]
    if (!fill.visible) continue
    const fillIndex = options.bindToNodeFills === false ? -1 : index
    const applied = options.patternStack
      ? applyFill(r, fill, node, graph, fillIndex, options.patternStack)
      : r.applyFill(fill, node, graph, fillIndex)
    if (!applied) continue
    r.fillPaint.setAlphaf(fill.opacity)
    const blends = fill.blendMode !== undefined && fill.blendMode !== 'NORMAL'
    if (blends) setPaintBlendMode(r, r.fillPaint, fill.blendMode)
    draw(fill)
    clearFillShader(r)
    if (blends) setPaintBlendMode(r, r.fillPaint, 'NORMAL')
  }
}

export function drawVectorMultiStyleFills(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  patternStack?: Set<string>
): boolean {
  const network = node.type === 'VECTOR' ? node.vectorNetwork : null
  if (!network || !hasRegionFills(network)) return false
  const { regions } = network
  const paths =
    (fillGeometryMatchesRegions(node.fillGeometry, network) ? r.getFillGeometry(node) : null) ??
    r.getVectorPaths(node)
  if (!paths) return false

  for (const [index, region] of regions.entries()) {
    const path = paths[index]
    paintFills(
      r,
      region.fills ?? node.fills,
      node,
      graph,
      () => canvas.drawPath(path, r.fillPaint),
      { bindToNodeFills: !region.fills, patternStack }
    )
  }
  return true
}

/** Clears the fill paint's shader, when it has one; a layer with plain fills makes no call. */
export function clearFillShader(r: SkiaRenderer): void {
  if (!r.fillPaintShaded) return
  r.fillPaint.setShader(null)
  r.fillPaintShaded = false
}

export function clearStrokeShader(r: SkiaRenderer): void {
  if (!r.strokePaintShaded) return
  r.strokePaint.setShader(null)
  r.strokePaintShaded = false
}

/** Records that `paint`, when it is a shared one, now carries a shader. */
function markShaded(r: SkiaRenderer, paint: Paint): void {
  if (paint === r.fillPaint) r.fillPaintShaded = true
  else if (paint === r.strokePaint) r.strokePaintShaded = true
}

export function drawNodeFill(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): void {
  if (node.type === 'TEXT') r.renderText(canvas, node, fill)
  else if (node.type !== 'LINE') {
    withNodeOutline(r, node, (outline) => drawOutline(canvas, outline, r.fillPaint))
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
  clearFillShader(r)

  if (fill.type === 'SOLID') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColorComponents(c.r, c.g, c.b, c.a)
    return true
  }

  if (fill.type.startsWith('GRADIENT') && fill.gradientStops && fill.gradientTransform) {
    return applyGradientFill(r, fill, node, graph)
  }

  if (fill.type === 'IMAGE' && fill.imageHash) {
    return applyImageFill(r, fill, node, graph)
  }

  if (fill.type === 'PATTERN' && applyPatternFill(r, fill, node, graph, patternStack)) return true

  if (fill.type === 'PATTERN' || fill.type === 'NOISE' || fill.type === 'CUSTOM') {
    const c = r.resolveFillColor(fill, fillIndex, node, graph)
    r.fillPaint.setColorComponents(c.r, c.g, c.b, c.a)
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

  for (const position of layout.positions) {
    canvas.save()
    canvas.translate(position.x, position.y)
    canvas.scale(layout.scale, layout.scale)
    if (!drawVectorMultiStyleFills(r, canvas, source, graph, patternStack)) {
      paintFills(
        r,
        source.fills,
        source,
        graph,
        (sourceFill) => drawNodeFill(r, canvas, source, sourceFill),
        { patternStack }
      )
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
  r.fillPaintShaded = true
  shader.delete()
  picture.delete()
  return true
}

/**
 * Gradient space to the layer's pixels: Figma's transform maps the other way, so it is inverted.
 * A side with no length counts as one pixel, so a straight line still carries its gradient.
 */
function makeGradientLocalMatrix(
  r: SkiaRenderer,
  width: number,
  height: number,
  transform: NonNullable<Fill['gradientTransform']>
) {
  const t = invertGradientTransform(transform)
  return r.ck.Matrix.multiply(r.ck.Matrix.scaled(width || 1, height || 1), [
    t.m00,
    t.m01,
    t.m02,
    t.m10,
    t.m11,
    t.m12,
    0,
    0,
    1
  ])
}

/** Resolves one gradient stop's color, so a stroke resolves its own bindings, not a fill's. */
export type ResolveGradientStop = (color: Color, stopIndex: number) => Color

/**
 * Sets `paint`'s shader to `fill`'s gradient on `node` and returns whether it did. CanvasKit
 * builds no shader when the local matrix cannot be inverted, as for a transform that holds no
 * numbers; the paint then keeps no shader, and the caller draws nothing rather than its color.
 */
export function applyGradientFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  paint: Paint = r.fillPaint,
  resolveStop: ResolveGradientStop = (color, stopIndex) =>
    r.resolveFillColorInfo(
      { ...fill, type: 'SOLID', color, opacity: color.a, visible: true },
      stopIndex,
      node,
      graph
    ).color
): boolean {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return false
  const colors = stops.map((s, index) => {
    const c = resolveStop(s.color, index)
    return r.ck.Color4f(c.r, c.g, c.b, c.a)
  })
  const positions = stops.map((s) => s.position)

  const w = node.width
  const h = node.height

  /** The paint keeps its own reference, so the caller's handle has to go or WASM memory grows. */
  const setShader = (shader: Shader | null): boolean => {
    if (!shader) return false
    try {
      paint.setShader(shader)
      markShaded(r, paint)
    } finally {
      shader.delete()
    }
    return true
  }

  if (fill.type === 'GRADIENT_LINEAR') {
    // Drawn in gradient space, so its bands follow the transform's second axis as in Figma
    // rather than running square to the line on a stretched layer.
    const shader = r.ck.Shader.MakeLinearGradient(
      [0, 0.5],
      [1, 0.5],
      colors,
      positions,
      r.ck.TileMode.Clamp,
      makeGradientLocalMatrix(r, w, h, t)
    )
    return setShader(shader)
  } else if (fill.type === 'GRADIENT_DIAMOND') {
    return setShader(makeDiamondGradient(r, colors, positions, makeGradientLocalMatrix(r, w, h, t)))
  } else if (fill.type === 'GRADIENT_RADIAL') {
    // Gradient space is centred on (0.5, 0.5) with radius 0.5; the local matrix takes it to the
    // layer's pixels.
    const localMatrix = makeGradientLocalMatrix(r, w, h, t)
    const shader = r.ck.Shader.MakeRadialGradient(
      [0.5, 0.5],
      0.5,
      colors,
      positions,
      r.ck.TileMode.Clamp,
      localMatrix
    )
    return setShader(shader)
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
    return setShader(shader)
  }
  return false
}

/**
 * Maps `img`'s pixels onto `node` as `fill` places them. `size` is the image's own size when `img`
 * is a downscaled preview, so a tile keeps its size. A crop places the image by its transform;
 * Fill, Fit and Tile ignore it, as Figma does, and turn the image by `imageRotation` first.
 */
export function makeImageFillLocalMatrix(
  fill: Fill,
  node: SceneNode,
  imgW: number,
  imgH: number,
  size: { width: number; height: number } = { width: imgW, height: imgH }
) {
  const scaleMode = fill.imageScaleMode ?? 'FILL'
  if (scaleMode === 'CROP' && fill.imageTransform) {
    const t = fill.imageTransform
    const inverse = Matrix.invert([t.m00, t.m01, t.m02, t.m10, t.m11, t.m12, 0, 0, 1])
    if (inverse)
      return Matrix.multiply(
        Matrix.scaled(node.width, node.height),
        inverse,
        Matrix.scaled(1 / imgW, 1 / imgH)
      )
  }

  const radians = ((fill.imageRotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const turnedW = size.width * cos + size.height * sin
  const turnedH = size.width * sin + size.height * cos
  const turned = Matrix.multiply(
    Matrix.translated(turnedW / 2, turnedH / 2),
    Matrix.rotated(radians),
    Matrix.translated(-size.width / 2, -size.height / 2),
    Matrix.scaled(size.width / imgW, size.height / imgH)
  )
  if (scaleMode === 'TILE') {
    const scale = fill.scale && fill.scale > 0 ? fill.scale : 1
    return Matrix.multiply(Matrix.scaled(scale, scale), turned)
  }
  const fit = scaleMode === 'FIT'
  const scale = (fit ? Math.min : Math.max)(node.width / turnedW, node.height / turnedH)
  return Matrix.multiply(
    Matrix.translated((node.width - turnedW * scale) / 2, (node.height - turnedH * scale) / 2),
    Matrix.scaled(scale, scale),
    turned
  )
}

/**
 * Sets `paint`'s shader to `img` laid out as `fill` places it on `node`; `preview`, when `img`
 * is a downscaled preview, keeps a tiled image at its original size.
 */
function setImageShader(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  img: Image,
  paint: Paint,
  preview?: { originalWidth: number; originalHeight: number }
): boolean {
  const imgW = img.width()
  const imgH = img.height()
  const scaleMode = fill.imageScaleMode ?? 'FILL'
  const localMatrix = makeImageFillLocalMatrix(
    fill,
    node,
    imgW,
    imgH,
    preview && { width: preview.originalWidth, height: preview.originalHeight }
  )
  const tileMode = scaleMode === 'FIT' ? r.ck.TileMode.Decal : r.ck.TileMode.Clamp
  const shader =
    scaleMode === 'TILE'
      ? img.makeShaderCubic(r.ck.TileMode.Repeat, r.ck.TileMode.Repeat, 1 / 3, 1 / 3, localMatrix)
      : img.makeShaderOptions(
          tileMode,
          tileMode,
          r.ck.FilterMode.Linear,
          r.ck.MipmapMode.Linear,
          localMatrix
        )
  try {
    paint.setShader(shader)
    markShaded(r, paint)
  } finally {
    shader.delete()
  }
  return true
}

export function applyImageFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  paint: Paint = r.fillPaint
): boolean {
  const hash = fill.imageHash
  if (!hash) return false
  const live = r.images.live.get(hash)
  if (live?.surface === r.surface) return setImageShader(r, fill, node, live.image, paint)
  if (r.viewportImageRendering) {
    r.noteImageFillUser(hash, node.id)
    r.images.previewsDrawn = true
  }
  // The preview's resolution follows the detail the drawing is for: the viewport's scale, or a
  // tile's level, whose chunk pictures record again when a finer tile needs more.
  const preview = r.viewportImageRendering
    ? r.images.previews.get(graph, hash, previewEdge(node, r.images.detailScale))
    : undefined
  if (r.viewportImageRendering && !preview) return false
  const key = preview?.key ?? hash
  let img = r.images.cache.get(key)
  let temporary = false
  if (!img) {
    const data = preview?.preview.bytes ?? graph.images.get(hash)
    if (!data) return false
    const decoded = r.ck.MakeImageFromEncoded(data)
    if (!decoded) return false
    try {
      img = decoded.makeCopyWithDefaultMipmaps()
    } finally {
      decoded.delete()
    }
    temporary = !r.images.cache.set(key, img)
  }

  try {
    return setImageShader(r, fill, node, img, paint, preview?.preview)
  } finally {
    if (temporary) img.delete()
  }
}
