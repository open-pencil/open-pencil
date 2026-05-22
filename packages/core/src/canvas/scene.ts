import type { Canvas } from 'canvaskit-wasm'

import { DROP_HIGHLIGHT_ALPHA, DROP_HIGHLIGHT_STROKE, SECTION_CORNER_RADIUS } from '#core/constants'
import type { SceneNode, SceneGraph, Fill } from '#core/scene-graph'
import type { Color } from '#core/types'
import { vectorNetworkToCenterlinePath } from '#core/vector'

import { renderBooleanOperation } from './boolean'
import { getAbsolutePositionFullCached, type AbsPosFullInfo } from './coordinate'
import type { SkiaRenderer, RenderOverlays } from './renderer'
import { drawNodeStroke, drawVectorPathStrokes, vectorStrokePaths } from './scene/stroke-draw'
import { renderText } from './scene/text-render'
import { nodeHasRadius } from './shapes'
import { drawDashedRRectWithSolidCorners, drawStyledRRectStroke } from './strokes'

export { renderText }

function drawVisibleFills(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph,
  draw: (fill: Fill, isFirstDrawnFill: boolean) => void
): void {
  let firstDrawn = true
  for (let fi = 0; fi < node.fills.length; fi++) {
    const fill = node.fills[fi]
    if (!fill.visible) continue
    if (!r.applyFill(fill, node, graph, fi)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    const imageShader = r.imageFillShader
    try {
      draw(fill, firstDrawn)
    } finally {
      firstDrawn = false
      try {
        r.fillPaint.setShader(null)
      } finally {
        if (imageShader) {
          if (r.imageFillShader === imageShader) r.imageFillShader = null
          imageShader.delete()
        }
      }
    }
  }
}

/** Check whether an AABB is fully outside the viewport. */
export function isAABBOutside(
  left: number,
  top: number,
  right: number,
  bottom: number,
  vp: { x: number; y: number; w: number; h: number }
): boolean {
  return left > vp.x + vp.w || top > vp.y + vp.h || right < vp.x || bottom < vp.y
}

/** Check whether a bounding circle is fully outside the viewport. */
export function isCircleOutside(
  cx: number,
  cy: number,
  radius: number,
  vp: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    cx - radius > vp.x + vp.w ||
    cy - radius > vp.y + vp.h ||
    cx + radius < vp.x ||
    cy + radius < vp.y
  )
}

function isCulled(r: SkiaRenderer, node: SceneNode, absInfo: AbsPosFullInfo): boolean {
  // Non-finite coordinates break all comparison operators (NaN > x is always false),
  // which means the node would pass through unculled. For non-leaf clipping frames,
  // this also defeats culling for their entire subtree. Bail out early so the
  // renderNode error boundary handles the bad data at a single node.
  if (!Number.isFinite(absInfo.boundX) || !Number.isFinite(absInfo.boundY)) return false
  if (!Number.isFinite(absInfo.width) || !Number.isFinite(absInfo.height)) return false

  const isLeaf = node.childIds.length === 0
  const isClippingContainer =
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    node.clipsContent
  if (!isLeaf && !isClippingContainer) return false

  const vp = r.worldViewport
  if (absInfo.rotation !== 0) {
    // Bounding circle check using the correct world center.
    // The rotation pivot is computed via the full world matrix.
    const diag = Math.hypot(absInfo.width, absInfo.height)
    return isCircleOutside(absInfo.centerX, absInfo.centerY, diag / 2, vp)
  }

  return isAABBOutside(
    absInfo.boundX,
    absInfo.boundY,
    absInfo.boundX + absInfo.width,
    absInfo.boundY + absInfo.height,
    vp
  )
}

/**
 * Check whether a node should be skipped due to its screen-space size
 * being too small to meaningfully render. This is a Level-of-Detail
 * optimization: at low zoom levels, tiny nodes contribute no visual
 * information but still consume CPU/GPU resources for fills, strokes,
 * effects, and text layout.
 *
 * Structural nodes are never LOD-culled:
 * - Containers with children (kids may be larger than parent)
 * - Nodes with visible effects (blurs/shadows extend beyond bounds)
 * - SECTION and COMPONENT_SET (organizational structure)
 */
function isLodCulled(r: SkiaRenderer, node: SceneNode, absInfo: AbsPosFullInfo): boolean {
  // Non-finite dimensions break comparison operators (NaN < x is always false),
  // so the node would survive culling by accident rather than by design.
  // Bail out explicitly, consistent with isCulled's NaN guard.
  if (!Number.isFinite(absInfo.width) || !Number.isFinite(absInfo.height)) return false

  // Structural nodes are never LOD-culled — they carry organizational meaning
  // or have children/effects that extend beyond their own bounds.
  if (node.childIds.length > 0) return false
  if (node.effects.length > 0 && node.effects.some((e) => e.visible)) return false
  if (node.type === 'SECTION' || node.type === 'COMPONENT_SET') return false

  const minScreenSize = baseLodThreshold(r)
  if (minScreenSize <= 0) return false

  return baseLodScreenMetric(node, absInfo, r.zoom) < minScreenSize
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

function renderChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays
): void {
  if (node.type === 'BOOLEAN_OPERATION') return
  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
    canvas.save()
    if (nodeHasRadius(node)) {
      canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, true)
    }
    for (const childId of node.childIds) {
      r.renderNode(canvas, graph, childId, overlays)
    }
    canvas.restore()
  } else {
    for (const childId of node.childIds) {
      r.renderNode(canvas, graph, childId, overlays)
    }
  }
}

function effectLodBoost(r: SkiaRenderer): number {
  return r._isViewportAnimating && r._adaptiveLodBoost > 0 ? r._adaptiveLodBoost : 1
}

function baseLodThreshold(r: SkiaRenderer): number {
  let minScreenSize = r.minScreenSize
  if (r._isViewportAnimating) {
    minScreenSize = Math.max(minScreenSize, r.adaptiveMinScreenSize)
  }
  if (minScreenSize <= 0) return 0
  return minScreenSize * effectLodBoost(r)
}

export function baseLodScreenMetric(
  node: SceneNode,
  absInfo: AbsPosFullInfo | null | undefined,
  zoom: number
): number {
  if (node.type === 'LINE') {
    const absW = absInfo?.width ?? node.width
    const absH = absInfo?.height ?? node.height
    const screenLength = Math.max(Math.abs(absW * zoom), Math.abs(absH * zoom))
    return screenLength * screenLength
  }
  const w = absInfo?.width ?? node.width
  const h = absInfo?.height ?? node.height
  return w * h * zoom * zoom
}

export function effectLodScreenMetric(
  node: SceneNode,
  zoom: number,
  absInfo?: AbsPosFullInfo | null
): number {
  const w = absInfo?.width ?? node.width
  const h = absInfo?.height ?? node.height
  const screenWidth = Math.abs(w * zoom)
  const screenHeight = Math.abs(h * zoom)
  if (node.type === 'LINE') {
    const screenLength = Math.max(screenWidth, screenHeight)
    return screenLength * screenLength
  }
  return screenWidth * screenHeight
}

export function renderNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  overlays: RenderOverlays
): void {
  const node = graph.getNode(nodeId)
  if (!node || !node.visible) return

  // Hide the node being edited in node-edit mode (overlay draws it live)
  if (overlays.nodeEditState?.nodeId === nodeId) return

  r._nodeCount++

  // Use cached getAbsolutePositionFull to avoid O(depth) parent chain walks
  // on every frame during pan/zoom. Cache is invalidated when sceneVersion or
  // pageId changes (see pipeline.ts cache lifecycle).
  const absInfo = getAbsolutePositionFullCached(node, graph, r._absPosFullCache)

  // Expose absInfo to LOD metric functions (effectLodScreenMetric,
  // tryRenderTextLOD) so they can compute world-space screen area
  // instead of using local node dimensions. Save/restore pattern
  // ensures the parent's absInfo is restored after rendering children
  // (which recursively call renderNode and overwrite _currentAbsInfo).
  // try/finally ensures cleanup on early returns (culling), exceptions,
  // and normal exit — maintaining the invariant that after this
  // renderNode returns, _currentAbsInfo equals whatever it was before.
  const prevAbsInfo = r._currentAbsInfo
  r._currentAbsInfo = absInfo
  try {
    if (isCulled(r, node, absInfo)) {
      r._culledCount++
      return
    }

    if (isLodCulled(r, node, absInfo)) {
      r._lodCulledCount++
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
    // ── Effect LOD: skip expensive layer blur saveLayer for nodes
    // ── too small to benefit from the effect. renderShape() already
    // ── increments _effectLodCulledCount for effect LOD; we guard
    // ── only the saveLayer/restore pair here to keep the count correct.
    const skipLayerBlur =
      layerBlur != null &&
      r.minScreenSizeForEffects > 0 &&
      effectLodScreenMetric(node, r.zoom, r._currentAbsInfo) <
        r.minScreenSizeForEffects * effectLodBoost(r)

    if (skipLayerBlur) {
      // SECTION/COMPONENT_SET/BOOLEAN_OPERATION bypass renderShape(), so
      // effectLodActive never increments the counter for them. Count layer
      // blur skips here so the metric is accurate across all node types.
      if (
        node.type === 'SECTION' ||
        node.type === 'COMPONENT_SET' ||
        node.type === 'BOOLEAN_OPERATION'
      ) {
        r._effectLodCulledCount++
      }
    }

    if (layerBlur && !skipLayerBlur) {
      // Entry guard: reset shared paint to known state
      r.effectLayerPaint.setImageFilter(null)
      r.effectLayerPaint.setColorFilter(null)
      r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

      r.effectLayerPaint.setImageFilter(r.getCachedBlur(layerBlur.radius / 2))
      canvas.saveLayer(r.effectLayerPaint)
    }

    applyNodeTransforms(r, canvas, node, nodeId, overlays)
    renderNodeContent(r, canvas, graph, node, nodeId, overlays)
    renderChildren(r, canvas, graph, node, overlays)

    if (layerBlur && !skipLayerBlur) {
      canvas.restore()
      // Exit guard: ensure shared paint is in clean state
      r.effectLayerPaint.setImageFilter(null)
      r.effectLayerPaint.setColorFilter(null)
      r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    }
    if (node.opacity < 1) {
      canvas.restore()
    }
    canvas.restore()
  } finally {
    r._currentAbsInfo = prevAbsInfo
  }
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

  drawVisibleFills(r, node, graph, (_fill, _isFirstDrawnFill) =>
    canvas.drawRRect(rrect, r.fillPaint)
  )

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

  drawVisibleFills(r, node, graph, (_fill, _isFirstDrawnFill) =>
    canvas.drawRRect(rrect, r.fillPaint)
  )

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
  const dashEffect = r.ck.PathEffect.MakeDash(
    [r.COMPONENT_SET_DASH / r.zoom, r.COMPONENT_SET_DASH_GAP / r.zoom],
    0
  )
  try {
    r.auxStroke.setPathEffect(dashEffect)
    canvas.drawRRect(rrect, r.auxStroke)
  } finally {
    try {
      r.auxStroke.setPathEffect(null)
    } finally {
      dashEffect.delete()
    }
  }
}

export function renderShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const hasEffects = node.effects.length > 0 && node.effects.some((e) => e.visible)

  // ── Effect LOD: skip expensive shadow/blur saveLayer ops ──
  // Effects (shadows, blurs) involve saveLayer which is costly.
  // For tiny nodes, effects are invisible — skip them entirely while
  // still rendering fills and strokes normally.
  let effectLodActive = false
  if (hasEffects && r.minScreenSizeForEffects > 0) {
    if (
      effectLodScreenMetric(node, r.zoom, r._currentAbsInfo) <
      r.minScreenSizeForEffects * effectLodBoost(r)
    ) {
      r._effectLodCulledCount++
      effectLodActive = true
    }
  }

  if (hasEffects && !effectLodActive) {
    const cached = r.nodePictureCache.get(node.id)
    if (cached) {
      canvas.drawPicture(cached)
      return
    }

    const margin = r.effectOverflow(node)
    const bounds = r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
    const recorder = new r.ck.PictureRecorder()
    const recCanvas = recorder.beginRecording(bounds)
    try {
      r.renderShapeUncached(recCanvas, node, graph)
      const picture = recorder.finishRecordingAsPicture()
      r.nodePictureCache.set(node.id, picture)
      canvas.drawPicture(picture)
    } finally {
      recorder.delete()
    }
  } else {
    r.renderShapeUncached(canvas, node, graph)
  }
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

export function renderShapeUncached(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  const hasRadius = nodeHasRadius(node)

  // ── Effect LOD: skip effects when node is too small ──
  // renderShape() already increments _effectLodCulledCount and bypasses
  // the picture cache. Here we actually skip the effect draw calls.
  // Must use the SAME boosted threshold as renderShape's effectLodActive
  // check to avoid both under-rendering and incorrect counter accounting.
  const skipEffects =
    r.minScreenSizeForEffects > 0 &&
    effectLodScreenMetric(node, r.zoom, r._currentAbsInfo) <
      r.minScreenSizeForEffects * effectLodBoost(r)

  const shadowChild = getShadowShapeChild(node, graph)
  if (!skipEffects) {
    r.renderEffects(canvas, node, rect, hasRadius, 'behind', shadowChild)
  }

  drawVisibleFills(r, node, graph, (fill, isFirstDrawnFill) =>
    r.drawNodeFill(canvas, node, rect, hasRadius, fill, isFirstDrawnFill)
  )

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
      try {
        drawVectorPathStrokes(r, canvas, [centerline], stroke, color)
      } finally {
        centerline.delete()
      }
      return
    }
    drawNodeStroke(r, canvas, node, rect, hasRadius, stroke, color, sg, vectorPaths, vectorStroke)
  })

  if (!skipEffects) {
    r.renderEffects(canvas, node, rect, hasRadius, 'front', shadowChild)
  }
}
