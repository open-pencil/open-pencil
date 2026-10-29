/* eslint-disable max-lines -- scene dispatch stays together while shape domains live in sibling modules */
import type { Canvas, Path } from 'canvaskit-wasm'

import { type SceneNode, type SceneGraph, type Fill } from '@open-pencil/scene-graph'
import {
  arrowCapOverflow,
  collectArrowEndpoints,
  hasTrimmedShaft,
  trimArrowShafts
} from '@open-pencil/scene-graph/arrow-caps'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { createSceneGeometry, nodeOrientationMatrix, projectedNode } from '#core/geometry'
import { shownText } from '#core/text/case'
import { mayHoldEmoji } from '#core/text/emoji'
import { fontManager } from '#core/text/fonts'
import {
  addStrokeRunToPath,
  strokeRuns,
  vectorNetworkToCenterlinePath,
  vectorNetworkToPath
} from '#core/vector'

import { figmaBlendModeToSkia, needsIsolatedBlendLayer } from './blend'
import { renderBooleanOperation } from './boolean'
import { blurSigma } from './effects'
import { drawVectorMultiStyleFills, paintFills } from './fills'
import { drawLayoutGrids } from './layout-grids'
import { renderMaskedChildIds } from './masks'
import type { SkiaRenderer, RenderOverlays } from './renderer'
import {
  canCacheEffectRaster,
  effectRasterScale,
  effectRasterScaleMatches
} from './renderer/effect-raster-cache'
import { mapVisualBounds, subtreeVisualBounds } from './renderer/visual-bounds'
import { isolatesInnerShadows, renderLayerShadows } from './shadows'
import { isLayerContainer } from './shadows/silhouette'
import {
  configureStrokePaint,
  drawArrowHeads,
  applyStrokeShader,
  drawDashedRRectWithSolidCorners,
  drawStyledRRectStroke,
  getStrokeCapEntity,
  getStrokeJoinEntity,
  normalizeDashPattern
} from './strokes'
import { drawLineStroke } from './strokes/line'
import { drawOutlinedDashes } from './strokes/outlined-dashes'
import { drawDashedRectStroke, strokeDashesByOutline, strokeSideWeights } from './strokes/sides'
import { textVerticalOffset, withTextParagraph } from './text'
import { drawTextLayout } from './text/decorations'
import {
  canDrawSavedText,
  drawDerivedText,
  drawReflowedPathTextSilhouettes,
  drawsSavedText,
  isReflowedPathText
} from './text/derived'
import { drawLaidOutEmoji, drawSavedEmoji } from './text/emoji'
import { stickyPlaceholderNode } from './text/placeholder'

function drawVisibleFills(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  draw: (fill: Fill) => void
): void {
  paintFills(r, node.fills, node, graph, draw)
}

function hasNodeTransform(node: SceneNode): boolean {
  return node.rotation !== 0 || node.flipX || node.flipY
}

function hasOverflowPathTextPaint(node: SceneNode): boolean {
  return (
    node.textPathData != null &&
    ((node.derivedTextGlyphs?.length ?? 0) > 0 ||
      (Array.isArray(node.strokeGeometry) && node.strokeGeometry.length > 0))
  )
}

function isCulled(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  absX: number,
  absY: number,
  hasTransformedAncestor: boolean,
  preview?: RenderOverlays['rotationPreview']
): boolean {
  const canCull =
    node.childIds.length === 0 ||
    ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      node.clipsContent)
  if (!canCull || hasOverflowPathTextPaint(node)) return false

  const vp = r.worldViewport
  if (hasTransformedAncestor) {
    const bounds = createSceneGeometry(graph, preview).bounds(node)
    return (
      bounds.x > vp.x + vp.w ||
      bounds.y > vp.y + vp.h ||
      bounds.x + bounds.width < vp.x ||
      bounds.y + bounds.height < vp.y
    )
  }
  const bw = node.width
  const bh = node.height
  if (projectedNode(node, preview).rotation !== 0) {
    const diag = Math.hypot(bw, bh)
    const { x: cx, y: cy } = createSceneGeometry(graph, preview).toWorld(node, {
      x: bw / 2,
      y: bh / 2
    })
    return (
      cx - diag / 2 > vp.x + vp.w ||
      cy - diag / 2 > vp.y + vp.h ||
      cx + diag / 2 < vp.x ||
      cy + diag / 2 < vp.y
    )
  }
  return absX > vp.x + vp.w || absY > vp.y + vp.h || absX + bw < vp.x || absY + bh < vp.y
}

function applyNodeTransforms(canvas: Canvas, node: SceneNode, overlays: RenderOverlays): void {
  canvas.concat(nodeOrientationMatrix(node, overlays.rotationPreview))
}
function renderNodeContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays
): void {
  if (node.type === 'SECTION') {
    r.renderSection(canvas, node, graph)
  } else if (node.type === 'COMPONENT_SET' && !overlays.playing) {
    // A previewing canvas draws a set as a plain frame.
    r.renderComponentSet(canvas, node, graph)
  } else if (node.type === 'BOOLEAN_OPERATION') {
    renderBooleanOperation(r, canvas, node, graph)
  } else {
    r.renderShape(canvas, node, graph)
  }
}

function renderMaskNodeContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  absX: number,
  absY: number
): void {
  canvas.save()
  canvas.translate(node.x, node.y)
  // As in Figma, a mask's opacity and layer blur reach what it masks; its blend mode does not.
  const blur = node.effects.find(
    (effect) =>
      effect.visible && (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
  )
  const layered = node.opacity < 1 || blur !== undefined
  if (layered) {
    const padding = (blur?.radius ?? 0) * 2
    r.opacityPaint.setAlphaf(node.opacity)
    r.opacityPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    r.opacityPaint.setImageFilter(blur ? r.getCachedBlur(blurSigma(blur.radius)) : null)
    canvas.saveLayer(
      r.opacityPaint,
      r.ck.LTRBRect(-padding, -padding, node.width + padding, node.height + padding)
    )
    r.opacityPaint.setImageFilter(null)
  }
  applyNodeTransforms(canvas, node, overlays)
  renderNodeContent(r, canvas, graph, node.maskType === 'VECTOR' ? opaqueFills(node) : node, {})
  // A group or frame used as a mask masks with what its layers draw, as in Figma.
  renderChildren(r, canvas, graph, node, overlays, absX + node.x, absY + node.y, true)
  if (layered) canvas.restore()
  canvas.restore()
}

/** An outline mask masks with its shape alone, so Figma ignores how opaque its fills are. */
function opaqueFills(node: SceneNode): SceneNode {
  return {
    ...node,
    fills: node.fills.map((fill) => ({ ...fill, opacity: 1, color: { ...fill.color, a: 1 } }))
  }
}

function renderChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  childIds: string[],
  overlays: RenderOverlays,
  absX: number,
  absY: number,
  hasTransformedAncestor: boolean
): void {
  renderMaskedChildIds(
    r,
    canvas,
    childIds,
    (childId) => {
      const child = graph.getNode(childId)
      return child?.visible && child.isMask ? child.maskType : null
    },
    (childId) => r.renderNode(canvas, graph, childId, overlays, absX, absY, hasTransformedAncestor),
    (childId) => {
      const child = graph.getNode(childId)
      if (child) renderMaskNodeContent(r, canvas, graph, child, overlays, absX, absY)
    },
    (childId) => {
      const child = graph.getNode(childId)
      if (!child) return null
      return { x: child.x, y: child.y, width: child.width, height: child.height }
    }
  )
}

function renderChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  absX: number,
  absY: number,
  hasTransformedAncestor: boolean
): void {
  if (node.type === 'BOOLEAN_OPERATION') return
  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
    canvas.save()
    r.clipNodeShape(canvas, node)
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY, hasTransformedAncestor)
    canvas.restore()
  } else {
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY, hasTransformedAncestor)
  }
}
export function renderNodeSelf(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  overlays: RenderOverlays = {}
): void {
  const node = graph.getNode(nodeId)
  if (
    !node ||
    node.internalOnly ||
    !node.visible ||
    node.isMask ||
    fontManager.isNodeBlocked(nodeId)
  ) {
    return
  }
  canvas.save()
  canvas.translate(node.x, node.y)
  applyNodeTransforms(canvas, node, overlays)
  renderNodeContent(r, canvas, graph, node, overlays)
  drawLayoutGrids(r, canvas, node)
  canvas.restore()
}

function viewportLayerBounds(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  padding: number,
  preview?: RenderOverlays['rotationPreview']
): Float32Array | null {
  if (!r.boundEffectLayersToViewport) return null
  const inverse = Matrix.invert(createSceneGeometry(graph, preview).worldMatrix(node))
  if (!inverse) return null
  const viewport = r.worldViewport
  const bounds = mapVisualBounds(inverse, {
    minX: viewport.x,
    minY: viewport.y,
    maxX: viewport.x + viewport.w,
    maxY: viewport.y + viewport.h
  })
  return r.ck.LTRBRect(
    bounds.minX - padding,
    bounds.minY - padding,
    bounds.maxX + padding,
    bounds.maxY + padding
  )
}

/**
 * The layer opens after the node's x/y translation and before its rotation and flips, so the
 * subtree is measured through its orientation matrix.
 */
function nodeIsolationLayerBounds(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  preview?: RenderOverlays['rotationPreview']
): Float32Array {
  const viewportBounds = viewportLayerBounds(r, graph, node, 0, preview)
  if (viewportBounds) return viewportBounds
  const bounds = subtreeVisualBounds(graph, node, nodeOrientationMatrix(node, preview), preview)
  return r.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
}

/**
 * Whether the canvas draws a node itself: not hidden, a mask, blocked on fonts, drawn live by
 * node-edit mode, or left to a live island while the canvas previews.
 */
function drawsNode(node: SceneNode, overlays: RenderOverlays): boolean {
  if (node.internalOnly || !node.visible || node.isMask || fontManager.isNodeBlocked(node.id))
    return false
  return overlays.nodeEditState?.nodeId !== node.id && !overlays.playIslands?.has(node.id)
}

export function renderNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  overlays: RenderOverlays,
  parentAbsX = 0,
  parentAbsY = 0,
  hasTransformedAncestor = false
): void {
  const found = graph.getNode(nodeId)
  if (!found || !drawsNode(found, overlays)) return
  const node = stickyPlaceholderNode(graph, found, r.stickyPlaceholder) ?? found

  r._nodeCount++

  const absX = parentAbsX + node.x
  const absY = parentAbsY + node.y

  if (isCulled(r, graph, node, absX, absY, hasTransformedAncestor, overlays.rotationPreview)) {
    r._culledCount++
    return
  }

  canvas.save()
  canvas.translate(node.x, node.y)

  const needsNodeLayer = node.opacity < 1 || needsIsolatedBlendLayer(node.blendMode)
  if (needsNodeLayer) {
    const layerBounds = nodeIsolationLayerBounds(r, graph, node, overlays.rotationPreview)
    r.opacityPaint.setAlphaf(node.opacity)
    r.opacityPaint.setBlendMode(figmaBlendModeToSkia(r.ck, node.blendMode))
    canvas.saveLayer(r.opacityPaint, layerBounds)
  }

  const layerBlur = node.effects.find(
    (e) => e.visible && (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR')
  )
  if (layerBlur) {
    // Entry guard: reset shared paint to known state
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

    r.effectLayerPaint.setImageFilter(r.getCachedBlur(blurSigma(layerBlur.radius)))
    const blurPadding = layerBlur.radius * 2
    canvas.saveLayer(
      r.effectLayerPaint,
      viewportLayerBounds(r, graph, node, blurPadding, overlays.rotationPreview) ??
        r.ck.LTRBRect(
          -blurPadding,
          -blurPadding,
          node.width + blurPadding,
          node.height + blurPadding
        )
    )
  }

  applyNodeTransforms(canvas, node, overlays)
  renderLayerShadows(r, canvas, graph, node, 'behind')
  renderNodeContent(r, canvas, graph, node, overlays)
  drawLayoutGrids(r, canvas, node)
  renderChildren(
    r,
    canvas,
    graph,
    node,
    overlays,
    absX,
    absY,
    hasTransformedAncestor || hasNodeTransform(projectedNode(node, overlays.rotationPreview))
  )
  renderLayerShadows(r, canvas, graph, node, 'front')

  if (layerBlur) {
    canvas.restore()
    // Exit guard: ensure shared paint is in clean state
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
  if (needsNodeLayer) {
    canvas.restore()
    r.opacityPaint.setAlphaf(1)
    r.opacityPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
  canvas.restore()
}

function makeNodeRRect(r: SkiaRenderer, node: SceneNode, radius: number): Float32Array {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  return r.ck.RRectXY(rect, radius, radius)
}

/**
 * Every stroke a node draws passes through here, so a gradient or image stroke gets its shader
 * here rather than in each draw helper, and the shader is cleared before the next stroke.
 */
function forVisibleStrokes(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  draw: (stroke: SceneNode['strokes'][number], color: Color) => void
): void {
  for (let index = 0; index < node.strokes.length; index++) {
    const stroke = node.strokes[index]
    if (!stroke.visible) continue
    const draws = applyStrokeShader(r, stroke, index, node, graph)
    try {
      if (draws) draw(stroke, r.resolveStrokeColor(stroke, index, node, graph))
    } finally {
      r.strokePaint.setShader(null)
      r.fillPaint.setShader(null)
    }
  }
}

/** Fill a section's or set's rounded bounds and return them, for its strokes to follow. */
function fillRoundedBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): Float32Array {
  const rrect = makeNodeRRect(r, node, node.cornerRadius)
  drawVisibleFills(r, node, graph, () => canvas.drawRRect(rrect, r.fillPaint))
  return rrect
}

export function renderSection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rrect = fillRoundedBounds(r, canvas, node, graph)
  forVisibleStrokes(r, node, graph, (stroke, color) => {
    configureStrokePaint(r, node, stroke, color)

    if (node.independentStrokeWeights) r.drawIndividualSideStrokes(canvas, node, stroke)
    else if (!drawFigmaDashes(r, canvas, node, stroke)) {
      r.drawRRectStrokeWithAlign(canvas, rrect, node, stroke)
    }
  })
}

export function renderComponentSet(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rrect = fillRoundedBounds(r, canvas, node, graph)
  // A set without a stroke gets its dashed editing border from the overlay pass.
  forVisibleStrokes(r, node, graph, (stroke, color) => {
    configureStrokePaint(r, node, stroke, color)
    if (drawFigmaDashes(r, canvas, node, stroke)) return
    const dashPhase = stroke.dashPattern?.[1] ?? 0
    if (stroke.dashPattern && stroke.dashPattern.length > 0) {
      drawDashedRRectWithSolidCorners(
        r,
        canvas,
        node,
        stroke,
        color,
        // Skia fits a rounded rect's radii to its bounds; the dashed outline must match the fill.
        Math.min(node.cornerRadius, node.width / 2, node.height / 2),
        dashPhase
      )
    } else {
      drawStyledRRectStroke(r, canvas, rrect, node, stroke, color, dashPhase)
    }
  })
}

/** The effects `renderShape` draws: a container's shadows are drawn around its children instead. */
function shapeEffects(node: SceneNode): SceneNode['effects'] {
  const ownShadows = !isLayerContainer(node)
  return node.effects.filter(
    (effect) =>
      effect.visible &&
      (ownShadows || (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW'))
  )
}

function canRasterCacheEffects(node: SceneNode): boolean {
  const visibleEffects = shapeEffects(node)
  return (
    visibleEffects.length > 0 &&
    visibleEffects.every(
      (effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
    )
  )
}

export function renderShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const hasEffects = shapeEffects(node).length > 0
  if (r.viewportImageRendering || !hasEffects) {
    r.renderShapeUncached(canvas, node, graph)
    return
  }

  const canRasterCache = r.renderingSceneBacking && canRasterCacheEffects(node)
  const targetScale = effectRasterScale(r.zoom * r.dpr)
  const cachedRaster = canRasterCache ? r.effectRasterCache.get(node.id) : null
  if (
    cachedRaster &&
    (cachedRaster.fontGeneration !== r.fontGeneration ||
      !effectRasterScaleMatches(cachedRaster.scale, targetScale))
  ) {
    r.effectRasterCache.delete(node.id)
  } else if (cachedRaster) {
    canvas.drawImageRectOptions(
      cachedRaster.image,
      r.ck.LTRBRect(0, 0, cachedRaster.image.width(), cachedRaster.image.height()),
      r.ck.LTRBRect(
        cachedRaster.left,
        cachedRaster.top,
        cachedRaster.left + cachedRaster.width,
        cachedRaster.top + cachedRaster.height
      ),
      r.ck.FilterMode.Linear,
      r.ck.MipmapMode.None,
      null
    )
    return
  }

  const margin = Math.max(
    r.effectOverflow(node),
    arrowCapOverflow(node.strokes, node.strokeCap, node.vectorNetwork)
  )
  const width = node.width + margin * 2
  const height = node.height + margin * 2
  const scale = targetScale
  if (canRasterCache && canCacheEffectRaster(width, height, scale)) {
    const surface = r.surface.makeSurface({
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale),
      colorType: r.ck.ColorType.RGBA_8888,
      alphaType: r.ck.AlphaType.Premul,
      colorSpace: r.ck.ColorSpace.SRGB
    })
    const rasterCanvas = surface.getCanvas()
    try {
      rasterCanvas.clear(r.ck.TRANSPARENT)
      rasterCanvas.scale(scale, scale)
      rasterCanvas.translate(margin, margin)
      r.renderShapeUncached(rasterCanvas, node, graph)
      surface.flush()
      const image = surface.makeImageSnapshot()
      const retained = r.effectRasterCache.set(node.id, {
        image,
        left: -margin,
        top: -margin,
        width,
        height,
        scale,
        pixels: image.width() * image.height(),
        fontGeneration: r.fontGeneration
      })
      try {
        canvas.drawImageRectOptions(
          image,
          r.ck.LTRBRect(0, 0, image.width(), image.height()),
          r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin),
          r.ck.FilterMode.Linear,
          r.ck.MipmapMode.None,
          null
        )
      } finally {
        if (!retained) image.delete()
      }
      return
    } finally {
      surface.delete()
    }
  }

  const cached = r.nodePictureCache.get(node.id)
  const cachedGeneration = r.nodePictureCacheGenerations.get(node.id)
  if (cached && cachedGeneration === r.fontGeneration) {
    canvas.drawPicture(cached)
    return
  }
  if (cached) cached.delete()
  r.nodePictureCache.delete(node.id)
  r.nodePictureCacheGenerations.delete(node.id)

  const bounds = r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
  const recorder = new r.ck.PictureRecorder()
  try {
    const recCanvas = recorder.beginRecording(bounds)
    r.renderShapeUncached(recCanvas, node, graph)
    const picture = recorder.finishRecordingAsPicture()
    r.nodePictureCache.set(node.id, picture)
    r.nodePictureCacheGenerations.set(node.id, r.fontGeneration)
    canvas.drawPicture(picture)
  } finally {
    recorder.delete()
  }
}

function drawVectorStrokeGeometry(
  r: SkiaRenderer,
  canvas: Canvas,
  sg: Path[],
  sc: Color,
  opacity: number
): void {
  r.fillPaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.fillPaint.setAlphaf(opacity)
  for (const p of sg) canvas.drawPath(p, r.fillPaint)
}

function vectorStrokePaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.nodePaths.vectorStroke.get(node.id)
  if (cached) return cached

  // A path per run, so the corners inside a run join and only its open ends take caps.
  const { segments, vertices } = node.vectorNetwork
  const paths = strokeRuns(segments).map((run) => {
    const path = new r.ck.PathBuilder()
    addStrokeRunToPath(path, run, segments, vertices)
    return path.detachAndDelete()
  })

  if (paths.length === 0) return null
  r.nodePaths.store(r.nodePaths.vectorStroke, node.id, paths)
  return paths
}

/** Stroke outlines are cached under `<nodeId>|…`, which `NodePathCaches.invalidate` removes. */
function strokeOutlineKey(
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  source: 'runs' | 'regions'
): string {
  return `${node.id}|${source}|${stroke.weight}|${stroke.cap ?? node.strokeCap}|${stroke.join ?? node.strokeJoin}|${node.strokeMiterLimit}`
}

function drawVectorPathStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  vectorPaths: Path[],
  stroke: SceneNode['strokes'][0],
  sc: Color,
  miterLimit: number,
  outlineCacheKey?: string
): void {
  const dash = normalizeDashPattern(stroke.dashPattern)
  if (dash.length > 0) {
    r.strokePaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
    r.strokePaint.setAlphaf(stroke.opacity)
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap ?? 'NONE'))
    r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join ?? 'MITER'))
    r.strokePaint.setStrokeMiter(miterLimit)
    const effect = r.ck.PathEffect.MakeDash(dash, 0)
    r.strokePaint.setPathEffect(effect)
    for (const vp of vectorPaths) canvas.drawPath(vp, r.strokePaint)
    r.strokePaint.setPathEffect(null)
    effect.delete()
    return
  }
  const strokeOpts = {
    width: stroke.weight,
    miter_limit: miterLimit,
    cap: getStrokeCapEntity(r, stroke.cap ?? 'NONE'),
    join: getStrokeJoinEntity(r, stroke.join ?? 'MITER')
  }
  r.fillPaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.fillPaint.setAlphaf(stroke.opacity)

  const cached = outlineCacheKey ? r.nodePaths.strokeOutline.get(outlineCacheKey) : undefined
  if (cached) {
    for (const outline of cached) canvas.drawPath(outline, r.fillPaint)
    return
  }
  const outlines: Path[] = []
  for (const vp of vectorPaths) {
    const outline = vp.makeStroked(strokeOpts)
    if (outline) outlines.push(outline)
  }
  for (const outline of outlines) canvas.drawPath(outline, r.fillPaint)
  // Drawing copies the outline, so one without a cache key is done with here.
  if (outlineCacheKey) r.nodePaths.store(r.nodePaths.strokeOutline, outlineCacheKey, outlines)
  else for (const outline of outlines) outline.delete()
}

/**
 * Draws a dashed stroke on a rectangle, frame, section, or component set with Figma's dash
 * layout, and returns false when the stroke has no dashes or has round or square dash ends on
 * sides of their own weights, which that layout does not cover.
 */
function drawFigmaDashes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0]
): boolean {
  const dash = normalizeDashPattern(stroke.dashPattern)
  if (dash.length === 0) return false
  if (strokeDashesByOutline(node, stroke)) {
    drawDashedRectStroke(r, canvas, node, stroke, strokeSideWeights(node, stroke), dash)
  } else if (node.independentStrokeWeights) {
    return false
  } else {
    drawOutlinedDashes(r, canvas, node, stroke, dash)
  }
  return true
}

function drawRegularStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  sc: Color
): void {
  configureStrokePaint(r, node, stroke, sc)
  const dash = normalizeDashPattern(stroke.dashPattern)
  r.strokePaint.setPathEffect(dash.length > 0 ? r.ck.PathEffect.MakeDash(dash, 0) : null)

  if (node.independentStrokeWeights && r.isRectangularType(node.type)) {
    r.drawIndividualSideStrokes(canvas, node, stroke)
  } else if (!r.isRectangularType(node.type) || !drawFigmaDashes(r, canvas, node, stroke)) {
    r.drawStrokeWithAlign(canvas, node, stroke.align)
  }
}

function drawNodeStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
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
    const outlineKey = strokeOutlineKey(node, stroke, 'runs')
    drawVectorPathStrokes(r, canvas, vectorStroke, stroke, sc, node.strokeMiterLimit, outlineKey)
    return
  }
  if (!sg) {
    if (vectorPaths) {
      const outlineKey = strokeOutlineKey(node, stroke, 'regions')
      drawVectorPathStrokes(r, canvas, vectorPaths, stroke, sc, node.strokeMiterLimit, outlineKey)
    } else drawRegularStroke(r, canvas, node, stroke, sc)
    return
  }
  if (stroke.align !== 'INSIDE') {
    if (node.type === 'VECTOR' || node.type === 'TEXT') {
      drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    } else drawRegularStroke(r, canvas, node, stroke, sc)
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
    r.clipNodeShape(canvas, node)
  }
  drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
  canvas.restore()
}

function isPathTextWithStrokeGeometry(node: SceneNode): boolean {
  return (
    node.type === 'TEXT' &&
    node.textPathData !== null &&
    (node.derivedTextGlyphs?.length ?? 0) > 0 &&
    node.strokeGeometry.length > 0
  )
}

/**
 * Draws arrow-cap heads for a stroke on a vector's open path ends. Runs after the shaft
 * regardless of which branch painted it, so heads survive fills, non-center alignment, corner
 * radii, and dashed shafts.
 */
function drawNodeArrowHeads(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  color: Color
): void {
  if (node.type !== 'VECTOR' || !node.vectorNetwork) return
  const endpoints = collectArrowEndpoints(node.vectorNetwork, stroke.cap ?? node.strokeCap)
  if (endpoints.length > 0) {
    drawArrowHeads(r, canvas, endpoints, stroke.weight, color, stroke.opacity)
  }
}

function paintNodeStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  sg: Path[] | null,
  vectorPaths: Path[] | null,
  vectorStroke: Path[] | null
): void {
  forVisibleStrokes(r, node, graph, (stroke, color) => {
    if (node.type === 'LINE') {
      drawLineStroke(r, canvas, node, stroke, color)
      return
    }
    if (
      stroke.dashPattern &&
      stroke.dashPattern.length > 0 &&
      node.type === 'VECTOR' &&
      node.vectorNetwork
    ) {
      const centerline = vectorNetworkToCenterlinePath(r.ck, node.vectorNetwork, node.cornerRadius)
      drawVectorPathStrokes(r, canvas, [centerline], stroke, color, node.strokeMiterLimit)
      centerline.delete()
      drawNodeArrowHeads(r, canvas, node, stroke, color)
      return
    }
    const cap = stroke.cap ?? node.strokeCap
    if (
      !sg &&
      stroke.align === 'CENTER' &&
      node.type === 'VECTOR' &&
      node.vectorNetwork &&
      hasTrimmedShaft(node.vectorNetwork, cap)
    ) {
      // The line stops short of a triangle or equilateral head, so it is stroked from its own
      // pulled-back copy rather than the cached paths; saved stroke geometry is already trimmed.
      const network = trimArrowShafts(node.vectorNetwork, cap, stroke.weight)
      const paths = vectorNetworkToPath(r.ck, network, node.cornerRadius)
      drawVectorPathStrokes(r, canvas, paths, stroke, color, node.strokeMiterLimit)
      for (const path of paths) path.delete()
      drawNodeArrowHeads(r, canvas, node, stroke, color)
      return
    }
    drawNodeStroke(r, canvas, node, stroke, color, sg, vectorPaths, vectorStroke)
    drawNodeArrowHeads(r, canvas, node, stroke, color)
  })
}

/** Draws a shape with its own effects: Figma puts inner shadows over fills and under strokes. */
export function renderShapeUncached(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  r.renderEffects(canvas, node, graph, 'behind')
  paintShapeContent(r, canvas, node, graph, () => r.renderEffects(canvas, node, graph, 'inner'))
  r.renderEffects(canvas, node, graph, 'front')
}

/** Draws a shape's fills and strokes without its effects; `afterFills` runs between the two. */
export function paintShapeContent(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  afterFills?: () => void
): void {
  const sg = node.strokeGeometry.length > 0 ? r.getStrokeGeometry(node) : null
  const vectorPaths = node.type === 'VECTOR' ? r.getVectorPaths(node) : null
  const vectorStroke = node.type === 'VECTOR' ? vectorStrokePaths(r, node) : null
  const pathTextStrokeFirst = isPathTextWithStrokeGeometry(node)
  const reflowedPathText = isReflowedPathText(node)

  if (pathTextStrokeFirst) {
    paintNodeStrokes(r, canvas, node, graph, sg, vectorPaths, vectorStroke)
  }
  if (reflowedPathText) {
    forVisibleStrokes(r, node, graph, (stroke, color) =>
      drawReflowedPathTextSilhouettes(r, canvas, node, stroke, color)
    )
  }

  const isolated = afterFills !== undefined && isolatesInnerShadows(node)
  if (isolated) canvas.saveLayer()
  if (!drawVectorMultiStyleFills(r, canvas, node, graph)) {
    drawVisibleFills(r, node, graph, (fill) => r.drawNodeFill(canvas, node, fill))
  }
  if (node.type === 'TEXT') drawTextEmoji(r, canvas, node)
  afterFills?.()
  if (isolated) canvas.restore()

  if (!pathTextStrokeFirst && !reflowedPathText) {
    paintNodeStrokes(r, canvas, node, graph, sg, vectorPaths, vectorStroke)
  }
}

function hasComplexTextFill(fill?: Fill): boolean {
  return fill !== undefined && fill.type !== 'SOLID'
}

function drawPaintedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): boolean {
  if (!r.fontsLoaded || !r.fontProvider) return false
  // Apply the shader directly to native glyphs: coverage layers add another rounding pass.
  return withTextParagraph(
    r,
    node,
    r.ck.Color4f(0, 0, 0, 1),
    {
      halfLeading: true,
      foregroundPaint: r.fillPaint
    },
    (paragraph, prepared) => {
      const y = textVerticalOffset(node, paragraph.getHeight())
      drawTextLayout(r.ck, canvas, node, prepared, y, r.fillPaint)
      return true
    }
  )
}

function shouldClipTextToLayoutBox(node: SceneNode): boolean {
  return (
    !hasOverflowPathTextPaint(node) &&
    (node.textAutoResize === 'NONE' || node.textAutoResize === 'TRUNCATE')
  )
}

function drawResolvedPathText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  fontReadiness: ReturnType<SkiaRenderer['nodeFontReadiness']>,
  fill?: Fill
): boolean {
  return (
    // Resolving the exact face must not replace curved glyph placement with a straight paragraph.
    fontReadiness !== 'exhausted' &&
    node.textPathData !== null &&
    drawDerivedText(r, canvas, node, fill)
  )
}

/** Whether the text is drawn from the editor's own layout, which leaves its emoji to be drawn. */
function drawsLaidOutText(r: SkiaRenderer, node: SceneNode): boolean {
  if (!r.fontsLoaded || !r.fontProvider || node.textPathData !== null) return false
  const readiness = r.nodeFontReadiness(node)
  return readiness !== 'pending' && readiness !== 'exhausted' && mayHoldEmoji(shownText(node))
}

/**
 * The emoji of a text, once whatever fills it has, clipped as its glyphs are: over its saved
 * glyphs' placeholder squares, or over the blank squares the editor's layout gives them.
 */
function drawTextEmoji(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  const saved = drawsSavedText(node)
  if (!saved && !drawsLaidOutText(r, node)) return
  canvas.save()
  if (shouldClipTextToLayoutBox(node)) {
    canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, false)
  }
  if (saved) drawSavedEmoji(r, canvas, node)
  else {
    withTextParagraph(r, node, r.ck.BLACK, { halfLeading: true }, (paragraph) =>
      drawLaidOutEmoji(r, canvas, node, paragraph, textVerticalOffset(node, paragraph.getHeight()))
    )
  }
  canvas.restore()
}

function drawSavedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): boolean {
  return canDrawSavedText(node, fill) && drawDerivedText(r, canvas, node, fill)
}

export function renderText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): void {
  const text = node.text
  if (!text) return

  canvas.save()
  if (shouldClipTextToLayoutBox(node)) {
    canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, false)
  }

  if (drawSavedText(r, canvas, node, fill)) {
    canvas.restore()
    return
  }
  const fontReadiness = r.nodeFontReadiness(node)
  if (fontReadiness === 'pending') {
    canvas.restore()
    return
  }
  if (drawResolvedPathText(r, canvas, node, fontReadiness, fill)) {
    canvas.restore()
    return
  }
  if (fontReadiness === 'exhausted') {
    if (node.textPicture && r.isTextPictureCurrent(node)) {
      const pic = r.ck.MakePicture(node.textPicture)
      if (pic) {
        canvas.drawPicture(pic)
        pic.delete()
        canvas.restore()
        return
      }
    }
    if (drawDerivedText(r, canvas, node, fill)) {
      canvas.restore()
      return
    }
    canvas.restore()
    return
  }
  if (hasComplexTextFill(fill) && drawPaintedText(r, canvas, node)) {
    canvas.restore()
    return
  }
  if (r.fontsLoaded && r.fontProvider) {
    withTextParagraph(
      r,
      node,
      r.fillPaint.getColor(),
      { halfLeading: true },
      (paragraph, prepared) => {
        const paragraphY = textVerticalOffset(node, paragraph.getHeight())
        drawTextLayout(r.ck, canvas, node, prepared, paragraphY, r.fillPaint)
      }
    )
  } else if (r.textFont) {
    const fontSize = node.fontSize || r.DEFAULT_FONT_SIZE
    const paragraphY = textVerticalOffset(node, fontSize)
    canvas.drawText(shownText(node), 0, paragraphY + fontSize, r.fillPaint, r.textFont)
  }

  canvas.restore()
}
