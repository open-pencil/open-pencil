import type { Canvas } from 'canvaskit-wasm'

import { type SceneNode, type SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'
import { textLinesOverflow } from '@open-pencil/scene-graph/text'

import { drawIndividualSideStrokes } from '#core/canvas/strokes/sides'
import { nodeOrientationMatrix, projectedNode } from '#core/geometry'
import { fontManager } from '#core/text/font/manager'

import { needsIsolatedBlendLayer, setPaintBlendMode } from './blend'
import { renderBooleanOperation } from './boolean'
import { blurSigma } from './effects'
import { drawVectorMultiStyleFills, paintFills } from './fills'
import { drawLayoutGrids } from './layout-grids'
import { renderMaskedChildIds } from './masks'
import type { SkiaRenderer, RenderOverlays } from './renderer'
import { drawShapeThroughNodePicture } from './renderer/node-pictures'
import { mapVisualBounds, subtreeVisualBounds } from './renderer/visual-bounds'
import { isolatesInnerShadows, renderLayerShadows } from './shadows'
import {
  configureStrokePaint,
  drawDashedRRectWithSolidCorners,
  drawRRectStrokeWithAlign,
  drawStyledRRectStroke,
  forVisibleStrokes
} from './strokes'
import {
  drawFigmaDashes,
  isPathTextWithStrokeGeometry,
  paintNodeStrokes,
  vectorStrokePaths
} from './strokes/dispatch'
import { drawReflowedPathTextSilhouettes, isReflowedPathText } from './text/derived'
import { stickyPlaceholderNode } from './text/placeholder'
import { drawTextEmoji, hasOverflowPathTextPaint, renderText } from './text/render'

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

/**
 * The frame a node's children are placed in, composed on the way down: null while every ancestor
 * is an unrotated, unflipped translation, which `absX`/`absY` carry more cheaply; from the first
 * transformed layer on, its world matrix, so no node below it walks to the root to find its own.
 */
function childFrame(
  frame: Mat3 | null,
  node: SceneNode,
  parentAbsX: number,
  parentAbsY: number,
  preview?: RenderOverlays['rotationPreview']
): Mat3 | null {
  const projected = projectedNode(node, preview)
  if (frame) return Matrix.multiply(frame, getNodeLocalMatrix(projected))
  if (!hasNodeTransform(projected)) return null
  return Matrix.multiply(Matrix.translated(parentAbsX, parentAbsY), getNodeLocalMatrix(projected))
}

/** The node's world matrix from its frame, or from its absolute position when it has none. */
function worldMatrixIn(
  frame: Mat3 | null,
  node: SceneNode,
  parentAbsX: number,
  parentAbsY: number,
  preview?: RenderOverlays['rotationPreview']
): Mat3 {
  return (
    childFrame(frame, node, parentAbsX, parentAbsY, preview) ??
    Matrix.translated(parentAbsX + node.x, parentAbsY + node.y)
  )
}

function isCulled(
  r: SkiaRenderer,
  node: SceneNode,
  absX: number,
  absY: number,
  frame: Mat3 | null,
  preview?: RenderOverlays['rotationPreview']
): boolean {
  const canCull =
    node.childIds.length === 0 ||
    ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      node.clipsContent)
  if (!canCull || hasOverflowPathTextPaint(node)) return false
  // Text lines past a fixed-size box still draw, as in Figma.
  const linesOverflow = textLinesOverflow(node)

  const vp = r.worldViewport
  const bw = node.width
  const bh = node.height + linesOverflow
  if (frame || projectedNode(node, preview).rotation !== 0) {
    const bounds = mapVisualBounds(
      worldMatrixIn(frame, node, absX - node.x, absY - node.y, preview),
      {
        minX: 0,
        minY: 0,
        maxX: bw,
        maxY: bh
      }
    )
    return (
      bounds.minX > vp.x + vp.w ||
      bounds.minY > vp.y + vp.h ||
      bounds.maxX < vp.x ||
      bounds.maxY < vp.y
    )
  }
  return absX > vp.x + vp.w || absY > vp.y + vp.h || absX + bw < vp.x || absY + bh < vp.y
}

function applyNodeTransforms(canvas: Canvas, node: SceneNode, overlays: RenderOverlays): void {
  // Most layers are neither rotated nor flipped: their orientation is the identity, not a call.
  if (!hasNodeTransform(projectedNode(node, overlays.rotationPreview))) return
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
  absY: number,
  frame: Mat3 | null
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
  renderChildren(
    r,
    canvas,
    graph,
    node,
    overlays,
    absX + node.x,
    absY + node.y,
    childFrame(frame, node, absX, absY, overlays.rotationPreview)
  )
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
  frame: Mat3 | null
): void {
  renderMaskedChildIds(
    r,
    canvas,
    childIds,
    (childId) => {
      const child = graph.getNode(childId)
      return child?.visible && child.isMask ? child.maskType : null
    },
    (childId) => r.renderNode(canvas, graph, childId, overlays, absX, absY, frame),
    (childId) => {
      const child = graph.getNode(childId)
      if (child) renderMaskNodeContent(r, canvas, graph, child, overlays, absX, absY, frame)
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
  frame: Mat3 | null
): void {
  if (node.type === 'BOOLEAN_OPERATION') return
  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
    canvas.save()
    r.clipNodeShape(canvas, node)
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY, frame)
    canvas.restore()
  } else {
    renderChildIds(r, canvas, graph, node.childIds, overlays, absX, absY, frame)
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

function viewportLayerBounds(r: SkiaRenderer, world: Mat3, padding: number): Float32Array | null {
  if (!r.boundEffectLayersToViewport) return null
  const inverse = Matrix.invert(world)
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
  world: Mat3,
  preview?: RenderOverlays['rotationPreview']
): Float32Array {
  const viewportBounds = viewportLayerBounds(r, world, 0)
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

/**
 * Draws a layer and its subtree. `frame` is the world matrix of the nearest transformed ancestor,
 * or null when `parentAbsX`/`parentAbsY` place the layer; a chunk recorded in world space passes
 * its parent's transform.
 */
export function renderNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  overlays: RenderOverlays,
  parentAbsX = 0,
  parentAbsY = 0,
  frame: Mat3 | null = null
): void {
  const found = graph.getNode(nodeId)
  if (!found || !drawsNode(found, overlays)) return
  const node = stickyPlaceholderNode(graph, found, r.stickyPlaceholder) ?? found

  r.drawCounts.nodes++

  const absX = parentAbsX + node.x
  const absY = parentAbsY + node.y

  if (isCulled(r, node, absX, absY, frame, overlays.rotationPreview)) {
    r.drawCounts.culled++
    return
  }

  canvas.save()
  canvas.translate(node.x, node.y)

  const world = () => worldMatrixIn(frame, node, parentAbsX, parentAbsY, overlays.rotationPreview)
  const needsNodeLayer = node.opacity < 1 || needsIsolatedBlendLayer(node.blendMode)
  if (needsNodeLayer) {
    const layerBounds = nodeIsolationLayerBounds(r, graph, node, world(), overlays.rotationPreview)
    r.opacityPaint.setAlphaf(node.opacity)
    setPaintBlendMode(r, r.opacityPaint, node.blendMode)
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
      viewportLayerBounds(r, world(), blurPadding) ??
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
    childFrame(frame, node, parentAbsX, parentAbsY, overlays.rotationPreview)
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

    if (node.independentStrokeWeights) drawIndividualSideStrokes(r, canvas, node, stroke)
    else if (!drawFigmaDashes(r, canvas, node, stroke)) {
      drawRRectStrokeWithAlign(r, canvas, rrect, node, stroke)
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

export function renderShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const effects = shapeEffects(node)
  if (r.viewportImageRendering || effects.length === 0) {
    r.renderShapeUncached(canvas, node, graph)
    return
  }

  drawShapeThroughNodePicture(r, canvas, node, (target) =>
    r.renderShapeUncached(target, node, graph)
  )
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

export { renderText }
