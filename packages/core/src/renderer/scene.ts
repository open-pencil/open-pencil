import { DROP_HIGHLIGHT_ALPHA, DROP_HIGHLIGHT_STROKE, SECTION_CORNER_RADIUS } from '../constants'
import type { SceneNode, SceneGraph } from '../scene-graph'
import type { Canvas, EmbindEnumEntity, Path } from 'canvaskit-wasm'
import type { Color } from '../types'
import type { SkiaRenderer, RenderOverlays } from './renderer'

function isCulled(
  r: SkiaRenderer,
  node: SceneNode,
  absX: number,
  absY: number
): boolean {
  const canCull =
    node.childIds.length === 0 ||
    ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      node.clipsContent)
  if (!canCull) return false

  const vp = r.worldViewport
  const bw = node.width
  const bh = node.height
  if (node.rotation !== 0) {
    const diag = Math.sqrt(bw * bw + bh * bh)
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
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  nodeId: string,
  overlays: RenderOverlays
): void {
  const rotation =
    overlays.rotationPreview?.nodeId === nodeId ? overlays.rotationPreview.angle : node.rotation
  if (rotation !== 0) {
    canvas.rotate(rotation, node.width / 2, node.height / 2)
  }

  if (node.flipX || node.flipY) {
    canvas.translate(
      node.flipX ? node.width : 0,
      node.flipY ? node.height : 0
    )
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

function renderChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays,
  absX: number,
  absY: number
): void {
  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
    canvas.save()
    const hasRadius = node.cornerRadius > 0 || (node.independentCorners &&
      (node.topLeftRadius > 0 || node.topRightRadius > 0 || node.bottomRightRadius > 0 || node.bottomLeftRadius > 0))
    if (hasRadius) {
      canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, true)
    }
    for (const childId of node.childIds) {
      r.renderNode(canvas, graph, childId, overlays, absX, absY)
    }
    canvas.restore()
  } else {
    for (const childId of node.childIds) {
      r.renderNode(canvas, graph, childId, overlays, absX, absY)
    }
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
  if (!node || !node.visible) return

  r._nodeCount++

  const absX = parentAbsX + node.x
  const absY = parentAbsY + node.y

  if (isCulled(r, node, absX, absY)) {
    r._culledCount++
    return
  }

  canvas.save()
  canvas.translate(node.x, node.y)

  if (node.opacity < 1) {
    r.opacityPaint.setAlphaf(node.opacity)
    canvas.saveLayer(r.opacityPaint)
  }

  const layerBlur = node.effects.find(
    (e) => e.visible && (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR')
  )
  if (layerBlur) {
    r.effectLayerPaint.setImageFilter(r.getCachedBlur(layerBlur.radius / 2))
    canvas.saveLayer(r.effectLayerPaint)
  }

  applyNodeTransforms(r, canvas, node, nodeId, overlays)
  renderNodeContent(r, canvas, graph, node, nodeId, overlays)
  renderChildren(r, canvas, graph, node, overlays, absX, absY)

  if (layerBlur) {
    canvas.restore()
  }
  if (node.opacity < 1) {
    canvas.restore()
  }
  canvas.restore()
}

export function renderSection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  const rrect = r.ck.RRectXY(rect, SECTION_CORNER_RADIUS, SECTION_CORNER_RADIUS)

  for (let fi = 0; fi < node.fills.length; fi++) {
    const fill = node.fills[fi]
    if (!fill.visible) continue
    if (!r.applyFill(fill, node, graph, fi)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    canvas.drawRRect(rrect, r.fillPaint)
    r.fillPaint.setShader(null)
  }

  for (let si = 0; si < node.strokes.length; si++) {
    const stroke = node.strokes[si]
    if (!stroke.visible) continue
    const sc = r.resolveStrokeColor(stroke, si, node, graph)
    r.strokePaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setAlphaf(stroke.opacity)

    if (node.independentStrokeWeights) {
      r.drawIndividualSideStrokes(canvas, node, stroke.align)
    } else {
      r.drawRRectStrokeWithAlign(canvas, rrect, node, stroke)
    }
  }
}

export function renderComponentSet(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  const rrect = r.ck.RRectXY(rect, 5, 5)

  for (let fi = 0; fi < node.fills.length; fi++) {
    const fill = node.fills[fi]
    if (!fill.visible) continue
    if (!r.applyFill(fill, node, graph, fi)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    canvas.drawRRect(rrect, r.fillPaint)
    r.fillPaint.setShader(null)
  }

  r.auxStroke.setStrokeWidth(r.COMPONENT_SET_BORDER_WIDTH / r.zoom)
  r.auxStroke.setColor(r.compColor())
  r.auxStroke.setPathEffect(
    r.ck.PathEffect.MakeDash(
      [r.COMPONENT_SET_DASH / r.zoom, r.COMPONENT_SET_DASH_GAP / r.zoom],
      0
    )
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

function nodeHasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

/**
 * When a container has no visible fills, Figma renders drop shadows
 * using the shape of its children rather than its own rectangle.
 * Returns the child to use for shadow shape, or null to use the node itself.
 */
function getShadowShapeChild(node: SceneNode, graph: SceneGraph): SceneNode | null {
  if (node.fills.some((f) => f.visible)) return null
  if (node.childIds.length === 0) return null
  const child = graph.getNode(node.childIds[0])
  if (!child?.visible) return null
  return child
}

function getCapEntity(r: SkiaRenderer, cap: string | undefined): EmbindEnumEntity {
  switch (cap) {
    case 'ROUND': return r.ck.StrokeCap.Round
    case 'SQUARE': return r.ck.StrokeCap.Square
    default: return r.ck.StrokeCap.Butt
  }
}

function getJoinEntity(r: SkiaRenderer, join: string | undefined): EmbindEnumEntity {
  switch (join) {
    case 'ROUND': return r.ck.StrokeJoin.Round
    case 'BEVEL': return r.ck.StrokeJoin.Bevel
    default: return r.ck.StrokeJoin.Miter
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
  r.fillPaint.setShader(null)
  for (const p of sg) canvas.drawPath(p, r.fillPaint)
}

function drawVectorPathStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  vectorPaths: Path[],
  stroke: SceneNode['strokes'][0],
  sc: Color
): void {
  const strokeOpts = {
    width: stroke.weight,
    miter_limit: 4,
    cap: getCapEntity(r, stroke.cap ?? 'NONE'),
    join: getJoinEntity(r, stroke.join ?? 'MITER')
  }
  r.fillPaint.setColor(r.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
  r.fillPaint.setAlphaf(stroke.opacity)
  r.fillPaint.setShader(null)
  for (const vp of vectorPaths) {
    const outline = vp.copy().stroke(strokeOpts)
    if (outline) {
      canvas.drawPath(outline, r.fillPaint)
      outline.delete()
    }
  }
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
    r.strokePaint.setStrokeCap(getCapEntity(r, stroke.cap))
  }
  if (stroke.join) {
    r.strokePaint.setStrokeJoin(getJoinEntity(r, stroke.join))
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

  for (let fi = 0; fi < node.fills.length; fi++) {
    const fill = node.fills[fi]
    if (!fill.visible) continue
    if (!r.applyFill(fill, node, graph, fi)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    r.drawNodeFill(canvas, node, rect, hasRadius)
    r.fillPaint.setShader(null)
  }

  const sg = node.type === 'VECTOR' ? r.getStrokeGeometry(node) : null
  const vectorPaths = !sg && node.type === 'VECTOR' ? r.getVectorPaths(node) : null
  for (let si = 0; si < node.strokes.length; si++) {
    const stroke = node.strokes[si]
    if (!stroke.visible) continue
    const sc = r.resolveStrokeColor(stroke, si, node, graph)

    if (sg) {
      drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
      continue
    }
    if (vectorPaths) {
      drawVectorPathStrokes(r, canvas, vectorPaths, stroke, sc)
      continue
    }
    drawRegularStroke(r, canvas, node, rect, hasRadius, stroke, sc)
  }

  r.renderEffects(canvas, node, rect, hasRadius, 'front')
}

export function renderEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  pass: 'behind' | 'front',
  shadowShapeChild?: SceneNode | null
): void {
  for (const effect of node.effects) {
    if (!effect.visible) continue

    if (pass === 'behind' && effect.type === 'DROP_SHADOW') {
      const sp = effect.spread
      const sigma = effect.radius / 2

      if (node.type === 'TEXT') {
        const shadowColor = r.ck.Color4f(
          effect.color.r,
          effect.color.g,
          effect.color.b,
          effect.color.a
        )
        const dropFilter = r.getCachedDropShadow(
          effect.offset.x,
          effect.offset.y,
          sigma,
          shadowColor
        )
        r.effectLayerPaint.setImageFilter(dropFilter)
        canvas.saveLayer(r.effectLayerPaint)
        r.renderText(canvas, node)
        canvas.restore()
      } else {
        // When a container has no visible fills, Figma renders the drop
        // shadow using the first child's shape (e.g. a rounded child
        // inside a rectangular wrapper).
        const shapeNode = shadowShapeChild ?? node
        const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius

        r.auxFill.setColor(
          r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
        )
        r.auxFill.setMaskFilter(r.getCachedMaskBlur(sigma))
        r.auxFill.setImageFilter(null)
        canvas.save()
        canvas.translate(effect.offset.x, effect.offset.y)
        if (shapeNode.type === 'ELLIPSE') {
          canvas.drawOval(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
        } else if (shapeHasRadius) {
          canvas.drawRRect(r.makeRRectWithSpread(shapeNode, sp), r.auxFill)
        } else {
          canvas.drawRect(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
        }
        canvas.restore()
        r.auxFill.setMaskFilter(null)
      }
    }

    if (pass === 'behind' && effect.type === 'BACKGROUND_BLUR') {
      r.applyClippedBlur(canvas, node, rect, hasRadius, effect.radius / 2)
    }

    if (pass === 'front' && effect.type === 'INNER_SHADOW') {
      if (node.type === 'TEXT') {
        r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(effect.radius))
        r.effectLayerPaint.setColorFilter(
          r.ck.ColorFilter.MakeBlend(
            r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
            r.ck.BlendMode.SrcIn
          )
        )
        canvas.saveLayer(r.effectLayerPaint)
        canvas.save()
        canvas.translate(effect.offset.x, effect.offset.y)
        r.renderText(canvas, node)
        canvas.restore()
        canvas.restore()
        r.effectLayerPaint.setColorFilter(null)
        continue
      }
      const sp = effect.spread
      r.auxFill.setColor(
        r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
      )
      r.auxFill.setImageFilter(r.getCachedDecalBlur(effect.radius))

      canvas.save()
      if (node.type === 'ELLIPSE') {
        const path = new r.ck.Path()
        path.addOval(rect)
        canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
        path.delete()
      } else if (hasRadius) {
        canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
      } else {
        canvas.clipRect(rect, r.ck.ClipOp.Intersect, true)
      }

      const expand = effect.radius * 2
      const big = r.ck.LTRBRect(
        -expand + effect.offset.x,
        -expand + effect.offset.y,
        node.width + expand + effect.offset.x,
        node.height + expand + effect.offset.y
      )
      const bigPath = new r.ck.Path()
      bigPath.addRect(big)
      if (node.type === 'ELLIPSE') {
        const innerPath = new r.ck.Path()
        const offsetRect = r.ck.LTRBRect(
          effect.offset.x + sp,
          effect.offset.y + sp,
          node.width + effect.offset.x - sp,
          node.height + effect.offset.y - sp
        )
        innerPath.addOval(offsetRect)
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      } else if (hasRadius) {
        const innerPath = new r.ck.Path()
        innerPath.addRRect(r.makeRRectWithOffset(node, effect.offset.x + sp, effect.offset.y + sp, -sp))
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      } else {
        const innerPath = new r.ck.Path()
        innerPath.addRect(
          r.ck.LTRBRect(
            effect.offset.x + sp,
            effect.offset.y + sp,
            node.width + effect.offset.x - sp,
            node.height + effect.offset.y - sp
          )
        )
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      }
      canvas.drawPath(bigPath, r.auxFill)
      bigPath.delete()
      canvas.restore()
      r.auxFill.setImageFilter(null)
    }
  }
}

export function renderText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  const text = node.text
  if (!text) return

  if (node.textPicture) {
    const pic = r.ck.MakePicture(node.textPicture)
    if (pic) {
      canvas.drawPicture(pic)
      pic.delete()
      return
    }
  }
  if (r.fontsLoaded && r.fontProvider) {
    const paragraph = r.buildParagraph(node, r.fillPaint.getColor(), { halfLeading: true })
    canvas.drawParagraph(paragraph, 0, 0)
    paragraph.delete()
  } else if (r.textFont) {
    canvas.save()
    canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, false)
    canvas.drawText(text, 0, node.fontSize || r.DEFAULT_FONT_SIZE, r.fillPaint, r.textFont)
    canvas.restore()
  }
}
