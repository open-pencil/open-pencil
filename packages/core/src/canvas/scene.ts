import type { Canvas } from '@open-pencil/canvaskit'
import { type SceneNode, type SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import { intersectVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { asMaskShape, isVisibleMask } from '@open-pencil/scene-graph/masks'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { clipsChildren, isLayerContainer } from '@open-pencil/scene-graph/node-defaults'

import { drawIndividualSideStrokes } from '#core/canvas/strokes/sides'
import { nodeOrientationMatrix, projectedNode } from '#core/geometry'
import { drawnLayerBlurReach, mapVisualBounds } from '#core/geometry/render-bounds'
import { fontManager } from '#core/text/font/manager'

import { needsIsolatedBlendLayer, setPaintBlendMode } from './blend/modes'
import { blurredContent, layerBlurFilter } from './blur/layer'
import { renderBooleanOperation } from './boolean'
import { renderLeafWithEffects } from './effects'
import { drawVectorMultiStyleFills, paintFills } from './fills/paint'
import { drawLayoutGrids } from './layout-grids'
import { renderMaskedChildIds } from './masks'
import { withNoiseEffects } from './noise/render'
import { drawShapeThroughNodePicture } from './renderer/node-pictures'
import type { SkiaRenderer, RenderOverlays } from './renderer/skia'
import {
  mapLayerBounds,
  subtreeVisualRectInParent,
  visibleLayerBlur
} from './renderer/visual-bounds'
import { isolatesInnerShadows, renderLayerShadows } from './shadows/render'
import {
  drawFigmaDashes,
  isPathTextWithStrokeGeometry,
  paintNodeStrokes,
  vectorStrokePaths
} from './strokes/dispatch'
import {
  configureStrokePaint,
  drawDashedRRectWithSolidCorners,
  drawRRectStrokeWithAlign,
  drawStyledRRectStroke,
  forVisibleStrokes
} from './strokes/draw'
import { drawReflowedPathTextSilhouettes, isReflowedPathText } from './text/derived'
import { drawTextEmoji, hasOverflowPathTextPaint, renderText } from './text/draw/text'
import { stickyPlaceholderNode } from './text/placeholder'
import { beginTexture, endTexture, visibleTexture } from './texture'

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

/**
 * Whether nothing a node and its subtree draw reaches the viewport: their rendered bounds
 * (`RenderedBoundsCache`), strokes, shadows, and blurs included, placed where the node lands.
 * Text set on a path draws its glyphs along the path, which those bounds do not follow.
 */
function isCulled(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  absX: number,
  absY: number,
  frame: Mat3 | null,
  preview?: RenderOverlays['rotationPreview']
): boolean {
  if (hasOverflowPathTextPaint(node)) return false
  const own = r.renderedBounds.ownAxes(graph, node, preview)
  const bounds =
    frame || hasNodeTransform(projectedNode(node, preview))
      ? mapLayerBounds(worldMatrixIn(frame, node, absX - node.x, absY - node.y, preview), own)
      : {
          minX: absX + own.minX,
          minY: absY + own.minY,
          maxX: absX + own.maxX,
          maxY: absY + own.maxY
        }
  const vp = r.worldViewport
  return (
    bounds.minX > vp.x + vp.w ||
    bounds.minY > vp.y + vp.h ||
    bounds.maxX < vp.x ||
    bounds.maxY < vp.y
  )
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
  // A mask whose fonts are still prepared masks nothing in yet, so what it masks stays hidden too.
  if (fontManager.isNodeBlocked(graph, node.id)) return
  canvas.save()
  canvas.translate(node.x, node.y)
  // As in Figma, a mask's opacity and layer blur reach what it masks; its blend mode does not.
  const blur = visibleLayerBlur(node)
  const layered = node.opacity < 1 || blur !== undefined
  if (layered) {
    const world = () => worldMatrixIn(frame, node, absX, absY, overlays.rotationPreview)
    r.opacityPaint.setAlphaf(node.opacity)
    r.opacityPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    const content = blurredContent(graph, node, overlays)
    r.opacityPaint.setImageFilter(blur ? layerBlurFilter(r, node, blur, overlays, content) : null)
    canvas.saveLayer(
      r.opacityPaint,
      nodeLayerBounds(r, graph, node, world, overlays.rotationPreview)
    )
    r.opacityPaint.setImageFilter(null)
  }
  applyNodeTransforms(canvas, node, overlays)
  renderNodeContent(r, canvas, graph, asMaskShape(node), {})
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
      return child && isVisibleMask(child) ? child.maskType : null
    },
    (childId) => r.renderNode(canvas, graph, childId, overlays, absX, absY, frame),
    (childId) => {
      const child = graph.getNode(childId)
      if (child) renderMaskNodeContent(r, canvas, graph, child, overlays, absX, absY, frame)
    },
    (childId) => {
      const child = graph.getNode(childId)
      return child
        ? subtreeVisualRectInParent(r.renderedBounds, graph, child, overlays.rotationPreview)
        : null
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
  if (clipsChildren(node) && node.childIds.length > 0) {
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
    fontManager.isNodeBlocked(graph, nodeId)
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

/**
 * The viewport in the axes a node's layers open in, `world` without its `orientation`, grown by
 * `padding` so ink blurred in from past it stays.
 */
function viewportLayerBounds(
  r: SkiaRenderer,
  world: Mat3,
  orientation: Mat3,
  padding: number
): VisualBounds | null {
  const inverseOrientation = Matrix.invert(orientation)
  const layerWorld = inverseOrientation ? Matrix.multiply(world, inverseOrientation) : world
  const inverse = Matrix.invert(layerWorld)
  if (!inverse) return null
  const viewport = r.worldViewport
  const bounds = mapVisualBounds(inverse, {
    minX: viewport.x,
    minY: viewport.y,
    maxX: viewport.x + viewport.w,
    maxY: viewport.y + viewport.h
  })
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding
  }
}

const NOTHING: VisualBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

/**
 * The bounds every layer a node opens shares: what its subtree puts on screen, cut to the
 * viewport when the renderer bounds layers to it. The layers open after the node's x/y
 * translation and before its rotation and flips, so the subtree is measured through its
 * orientation matrix, and the viewport through the world matrix without it.
 */
function nodeLayerBounds(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  world: () => Mat3,
  preview: RenderOverlays['rotationPreview']
): Float32Array {
  const orientation = nodeOrientationMatrix(node, preview)
  const subtree = mapLayerBounds(orientation, r.renderedBounds.ownAxes(graph, node, preview))
  if (!r.boundEffectLayersToViewport) {
    return r.ck.LTRBRect(subtree.minX, subtree.minY, subtree.maxX, subtree.maxY)
  }
  const viewport = viewportLayerBounds(r, world(), orientation, drawnLayerBlurReach(node))
  const bounds = viewport ? (intersectVisualBounds(viewport, subtree) ?? NOTHING) : subtree
  return r.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
}

/**
 * Whether the canvas draws a node itself: not hidden, a mask, blocked on fonts, drawn live by
 * node-edit mode, or left to a live island while the canvas previews.
 */
function drawsNode(graph: SceneGraph, node: SceneNode, overlays: RenderOverlays): boolean {
  if (
    node.internalOnly ||
    !node.visible ||
    node.isMask ||
    fontManager.isNodeBlocked(graph, node.id)
  )
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
  if (!found || !drawsNode(graph, found, overlays)) return
  const node = stickyPlaceholderNode(graph, found, r.stickyPlaceholder) ?? found

  r.drawCounts.nodes++

  const absX = parentAbsX + node.x
  const absY = parentAbsY + node.y

  if (isCulled(r, graph, node, absX, absY, frame, overlays.rotationPreview)) {
    r.drawCounts.culled++
    return
  }

  canvas.save()
  canvas.translate(node.x, node.y)

  const needsNodeLayer = node.opacity < 1 || needsIsolatedBlendLayer(node.blendMode)
  const layerBlur = visibleLayerBlur(node)
  const layerBounds =
    needsNodeLayer || layerBlur
      ? nodeLayerBounds(
          r,
          graph,
          node,
          () => worldMatrixIn(frame, node, parentAbsX, parentAbsY, overlays.rotationPreview),
          overlays.rotationPreview
        )
      : null
  if (needsNodeLayer) {
    r.opacityPaint.setAlphaf(node.opacity)
    setPaintBlendMode(r, r.opacityPaint, node.blendMode)
    canvas.saveLayer(r.opacityPaint, layerBounds)
  }

  if (layerBlur) {
    // Entry guard: reset shared paint to known state
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

    const content = blurredContent(graph, node, overlays)
    r.effectLayerPaint.setImageFilter(layerBlurFilter(r, node, layerBlur, overlays, content))
    canvas.saveLayer(r.effectLayerPaint, layerBounds)
  }

  applyNodeTransforms(canvas, node, overlays)
  renderLayerShadows(r, canvas, graph, node, 'behind')
  // A frame or group's texture roughens what it and its children draw, not its shadows, and its
  // noise grains the roughened result and its inner shadows, as in Figma. A shape does both itself.
  const container = isLayerContainer(node)
  const texture = container ? visibleTexture(node) : undefined
  const drawContent = () => {
    const textureSaves = texture ? beginTexture(r, canvas, node, texture) : 0
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
    endTexture(canvas, textureSaves)
    renderLayerShadows(r, canvas, graph, node, 'front')
  }
  if (container) withNoiseEffects(r, canvas, node, graph, drawContent)
  else drawContent()

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
  renderLeafWithEffects(r, canvas, node, graph, (inner) =>
    paintShapeContent(r, canvas, node, graph, inner)
  )
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
