/* eslint-disable max-lines -- scene dispatch stays together while shape domains live in sibling modules */
import type { Canvas, Path } from 'canvaskit-wasm'

import { DROP_HIGHLIGHT_ALPHA, DROP_HIGHLIGHT_STROKE, SECTION_CORNER_RADIUS } from '#core/constants'
import { computeDescendantVisualBounds } from '#core/geometry'
import type { SceneNode, SceneGraph, Fill } from '#core/scene-graph'
import type { Color } from '#core/types'
import { vectorNetworkToCenterlinePath } from '#core/vector'

import { figmaBlendModeToSkia, needsIsolatedBlendLayer } from './blend'
import { renderBooleanOperation } from './boolean'
import { drawLayoutGrids } from './layout-grids'
import { renderMaskedChildIds } from './masks'
import type { SkiaRenderer, RenderOverlays } from './renderer'
import { makeSmoothRRectPath, nodeHasRadius, nodeHasSmoothCorners } from './shapes'
import {
  drawDashedRRectWithSolidCorners,
  drawStyledRRectStroke,
  getStrokeCapEntity,
  getStrokeJoinEntity
} from './strokes'
import { drawFigmaDerivedText } from './text-derived'
import { textNodeToOutlinePath } from './text-outlines'

function drawVisibleFills(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  draw: (fill: Fill) => void
): void {
  for (let fi = 0; fi < node.fills.length; fi++) {
    const fill = node.fills[fi]
    if (!fill.visible) continue
    if (!r.applyFill(fill, node, graph, fi)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    r.fillPaint.setBlendMode(figmaBlendModeToSkia(r.ck, fill.blendMode))
    draw(fill)
    r.fillPaint.setShader(null)
    r.fillPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}
function isCulled(r: SkiaRenderer, node: SceneNode, absX: number, absY: number): boolean {
  const canCull =
    node.childIds.length === 0 ||
    ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      node.clipsContent)
  if (!canCull) return false

  const vp = r.worldViewport
  const bw = node.width
  const bh = node.height
  if (node.rotation !== 0) {
    const diag = Math.hypot(bw, bh)
    const cx = absX + bw / 2
    const cy = absY + bh / 2
    return (
      cx - diag / 2 > vp.x + vp.w ||
      cy - diag / 2 > vp.y + vp.h ||
      cx + diag / 2 < vp.x ||
      cy + diag / 2 < vp.y
    )
  }
  return absX > vp.x + vp.w || absY > vp.y + vp.h || absX + bw < vp.x || absY + bh < vp.y
}

function applyNodeTransforms(
  _r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  nodeId: string,
  overlays: RenderOverlays
): void {
  const rotation =
    overlays.rotationPreview?.nodeId === nodeId ? overlays.rotationPreview.angle : node.rotation
  if (rotation !== 0) {
    if (node.type === 'LINE') canvas.rotate(rotation, 0, 0)
    else canvas.rotate(rotation, node.width / 2, node.height / 2)
  }

  if (node.flipX || node.flipY) {
    canvas.translate(node.flipX ? node.width : 0, node.flipY ? node.height : 0)
    canvas.scale(node.flipX ? -1 : 1, node.flipY ? -1 : 1)
  }
}
function renderNodeContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  nodeId: string,
  overlays: RenderOverlays
): void {
  if (node.type === 'SECTION') {
    r.renderSection(canvas, node, graph)
  } else if (node.type === 'COMPONENT_SET') {
    r.renderComponentSet(canvas, node, graph)
  } else if (node.type === 'BOOLEAN_OPERATION') {
    renderBooleanOperation(r, canvas, node, graph)
  } else {
    r.renderShape(canvas, node, graph)
  }

  if (overlays.editingTextId === nodeId && overlays.textEditor?.state?.paragraph) {
    r.drawTextEditOverlay(canvas, node, overlays.textEditor)
  }

  if (overlays.dropTargetId === nodeId) {
    r.auxStroke.setStrokeWidth(DROP_HIGHLIGHT_STROKE / r.zoom)
    r.auxStroke.setColor(r.selColor(DROP_HIGHLIGHT_ALPHA))
    canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxStroke)
  }
}

function renderMaskNodeContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  nodeId: string,
  overlays: RenderOverlays
): void {
  canvas.save()
  canvas.translate(node.x, node.y)
  applyNodeTransforms(r, canvas, node, nodeId, overlays)
  renderNodeContent(r, canvas, graph, node, nodeId, {})
  canvas.restore()
}

function renderChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  childIds: string[],
  overlays: RenderOverlays,
  absX: number,
  absY: number
): void {
  renderMaskedChildIds(
    r,
    canvas,
    childIds,
    (childId) => {
      const child = graph.getNode(childId)
      return child?.visible && child.isMask ? child.maskType : null
    },
    (childId) => r.renderNode(canvas, graph, childId, overlays, absX, absY),
    (childId) => {
      const child = graph.getNode(childId)
      if (child) renderMaskNodeContent(r, canvas, graph, child, childId, overlays)
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
  absY: number
): void {
  if (node.type === 'BOOLEAN_OPERATION') return
  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
    canvas.save()
    if (nodeHasSmoothCorners(node)) {
      const clipPath = makeSmoothRRectPath(r, node)
      canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
      clipPath.delete()
    } else if (nodeHasRadius(node)) {
      canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, true)
    }
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY)
    canvas.restore()
  } else {
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY)
  }
}
export function renderNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  overlays: RenderOverlays,
  parentAbsX = 0,
  parentAbsY = 0
): void {
  const node = graph.getNode(nodeId)
  if (!node || !node.visible || node.isMask) return

  // Hide the node being edited in node-edit mode (overlay draws it live)
  if (overlays.nodeEditState?.nodeId === nodeId) return

  r._nodeCount++

  const absX = parentAbsX + node.x
  const absY = parentAbsY + node.y

  if (isCulled(r, node, absX, absY)) {
    r._culledCount++
    return
  }

  canvas.save()
  canvas.translate(node.x, node.y)

  const needsNodeLayer = node.opacity < 1 || needsIsolatedBlendLayer(node.blendMode)
  if (needsNodeLayer) {
    const bounds = computeDescendantVisualBounds(
      [nodeId],
      (id) => graph.getNode(id) ?? undefined,
      (id) => graph.getAbsolutePosition(id)
    )
    const layerBounds = bounds
      ? r.ck.LTRBRect(
          bounds.minX - absX,
          bounds.minY - absY,
          bounds.maxX - absX,
          bounds.maxY - absY
        )
      : r.ck.LTRBRect(0, 0, node.width, node.height)
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

    r.effectLayerPaint.setImageFilter(r.getCachedBlur(layerBlur.radius / 2))
    const blurPadding = layerBlur.radius * 2
    canvas.saveLayer(
      r.effectLayerPaint,
      r.ck.LTRBRect(-blurPadding, -blurPadding, node.width + blurPadding, node.height + blurPadding)
    )
  }

  applyNodeTransforms(r, canvas, node, nodeId, overlays)
  renderNodeContent(r, canvas, graph, node, nodeId, overlays)
  drawLayoutGrids(r, canvas, node)
  renderChildren(r, canvas, graph, node, overlays, absX, absY)

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

function forVisibleStrokes(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  draw: (stroke: SceneNode['strokes'][number], color: Color) => void
): void {
  for (let index = 0; index < node.strokes.length; index++) {
    const stroke = node.strokes[index]
    if (!stroke.visible) continue
    draw(stroke, r.resolveStrokeColor(stroke, index, node, graph))
  }
}

export function renderSection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rrect = makeNodeRRect(r, node, SECTION_CORNER_RADIUS)

  drawVisibleFills(r, node, graph, () => canvas.drawRRect(rrect, r.fillPaint))

  forVisibleStrokes(r, node, graph, (stroke, color) => {
    r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setAlphaf(stroke.opacity)

    if (node.independentStrokeWeights) r.drawIndividualSideStrokes(canvas, node, stroke.align)
    else r.drawRRectStrokeWithAlign(canvas, rrect, node, stroke)
  })
}

export function renderComponentSet(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rrect = makeNodeRRect(r, node, 5)

  drawVisibleFills(r, node, graph, () => canvas.drawRRect(rrect, r.fillPaint))

  const visibleStrokes = node.strokes.filter((stroke) => stroke.visible)
  if (visibleStrokes.length > 0) {
    forVisibleStrokes(r, node, graph, (stroke, color) => {
      const dashPhase = stroke.dashPattern?.[1] ?? 0
      if (stroke.dashPattern && stroke.dashPattern.length > 0) {
        drawDashedRRectWithSolidCorners(r, canvas, node, stroke, color, 5, dashPhase)
      } else {
        drawStyledRRectStroke(r, canvas, rrect, node, stroke, color, dashPhase)
      }
    })
    return
  }

  r.auxStroke.setStrokeWidth(r.COMPONENT_SET_BORDER_WIDTH / r.zoom)
  r.auxStroke.setColor(r.compColor())
  r.auxStroke.setPathEffect(
    r.ck.PathEffect.MakeDash([r.COMPONENT_SET_DASH / r.zoom, r.COMPONENT_SET_DASH_GAP / r.zoom], 0)
  )
  canvas.drawRRect(rrect, r.auxStroke)
  r.auxStroke.setPathEffect(null)
}

export function renderShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const hasEffects = node.effects.length > 0 && node.effects.some((e) => e.visible)

  if (hasEffects) {
    const cached = r.nodePictureCache.get(node.id)
    if (cached) {
      canvas.drawPicture(cached)
      return
    }

    const margin = r.effectOverflow(node)
    const bounds = r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
    const recorder = new r.ck.PictureRecorder()
    const recCanvas = recorder.beginRecording(bounds)
    r.renderShapeUncached(recCanvas, node, graph)
    const picture = recorder.finishRecordingAsPicture()
    recorder.delete()
    r.nodePictureCache.set(node.id, picture)
    canvas.drawPicture(picture)
  } else {
    r.renderShapeUncached(canvas, node, graph)
  }
}

function getShadowShapeChild(node: SceneNode, graph: SceneGraph): SceneNode | null {
  if (node.fills.some((f) => f.visible)) return null
  if (node.strokes.some((stroke) => stroke.visible)) return null
  if (node.childIds.length === 0) return null
  const child = graph.getNode(node.childIds[0])
  if (!child?.visible) return null
  return child
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
  r.fillPaint.setShader(null)
  for (const p of sg) canvas.drawPath(p, r.fillPaint)
}

function vectorStrokePaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
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

function drawVectorPathStrokes(
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
    r.strokePaint.setPathEffect(effect)
    for (const vp of vectorPaths) canvas.drawPath(vp, r.strokePaint)
    r.strokePaint.setPathEffect(null)
    effect.delete()
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
      const outline = vp.copy().stroke(strokeOpts)
      if (outline) outlines.push(outline)
    }
    if (outlineCacheKey) r.vectorStrokeOutlineCache.set(outlineCacheKey, outlines)
  }
  for (const outline of outlines) canvas.drawPath(outline, r.fillPaint)
}

function drawRegularStroke(
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
    r.strokePaint.setPathEffect(r.ck.PathEffect.MakeDash(stroke.dashPattern, 0))
  } else {
    r.strokePaint.setPathEffect(null)
  }

  if (node.independentStrokeWeights && r.isRectangularType(node.type)) {
    r.drawIndividualSideStrokes(canvas, node, stroke.align)
  } else {
    r.drawStrokeWithAlign(canvas, node, rect, hasRadius, stroke.align)
  }
}

function drawNodeStroke(
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
    if (node.type === 'VECTOR') drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    else drawRegularStroke(r, canvas, node, rect, hasRadius, stroke, sc)
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

export function renderShapeUncached(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  const hasRadius = nodeHasRadius(node)

  const shadowChild = getShadowShapeChild(node, graph)
  r.renderEffects(canvas, node, rect, hasRadius, 'behind', shadowChild)

  drawVisibleFills(r, node, graph, (fill) => r.drawNodeFill(canvas, node, rect, hasRadius, fill))

  const sg = node.strokeGeometry.length > 0 ? r.getStrokeGeometry(node) : null
  const vectorPaths = node.type === 'VECTOR' ? r.getVectorPaths(node) : null
  const vectorStroke = node.type === 'VECTOR' ? vectorStrokePaths(r, node) : null
  forVisibleStrokes(r, node, graph, (stroke, color) => {
    if (
      stroke.dashPattern &&
      stroke.dashPattern.length > 0 &&
      node.type === 'VECTOR' &&
      node.vectorNetwork
    ) {
      const centerline = vectorNetworkToCenterlinePath(r.ck, node.vectorNetwork)
      drawVectorPathStrokes(r, canvas, [centerline], stroke, color)
      centerline.delete()
      return
    }
    drawNodeStroke(r, canvas, node, rect, hasRadius, stroke, color, sg, vectorPaths, vectorStroke)
  })
  r.renderEffects(canvas, node, rect, hasRadius, 'front', shadowChild)
}

function isGradientFill(fill?: Fill): boolean {
  return fill?.type.startsWith('GRADIENT') === true
}

function shouldRenderTextAsOutline(fill?: Fill): boolean {
  return fill !== undefined && fill.type !== 'SOLID'
}

function drawOutlinedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): boolean {
  const path = textNodeToOutlinePath(r, node)
  if (!path) return false
  canvas.drawPath(path, r.fillPaint)
  path.delete()
  return true
}

function drawGradientText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paragraphY: number
): boolean {
  if (!r.fontsLoaded || !r.fontProvider) return false

  const paragraph = r.buildParagraph(node, r.ck.Color4f(0, 0, 0, 1))
  try {
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    const bounds = r.ck.LTRBRect(0, paragraphY, node.width, paragraphY + node.height)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    canvas.drawParagraph(paragraph, 0, paragraphY)

    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcIn)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.fillPaint)
    canvas.restore()
    canvas.restore()
    return true
  } finally {
    paragraph.delete()
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}

export function renderText(r: SkiaRenderer, canvas: Canvas, node: SceneNode, fill?: Fill): void {
  const text = node.text
  if (!text) return

  canvas.save()
  const shouldClipText = node.textAutoResize === 'NONE' || node.textAutoResize === 'TRUNCATE'
  if (shouldClipText) {
    canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, false)
  }

  const paragraphY = 0
  if (node.textPicture) {
    const pic = r.ck.MakePicture(node.textPicture)
    if (pic) {
      canvas.drawPicture(pic)
      pic.delete()
      canvas.restore()
      return
    }
  }
  if (drawFigmaDerivedText(r, canvas, node)) {
    canvas.restore()
    return
  }

  if (!r.isNodeFontLoaded(node)) {
    canvas.restore()
    return
  }
  if (shouldRenderTextAsOutline(fill) && drawOutlinedText(r, canvas, node)) {
    canvas.restore()
    return
  }
  if (isGradientFill(fill) && drawGradientText(r, canvas, node, paragraphY)) {
    canvas.restore()
    return
  }
  if (r.fontsLoaded && r.fontProvider) {
    const paragraph = r.buildParagraph(node, r.fillPaint.getColor())
    canvas.drawParagraph(paragraph, 0, paragraphY)
    paragraph.delete()
  } else if (r.textFont) {
    canvas.drawText(text, 0, node.fontSize || r.DEFAULT_FONT_SIZE, r.fillPaint, r.textFont)
  }

  canvas.restore()
}
