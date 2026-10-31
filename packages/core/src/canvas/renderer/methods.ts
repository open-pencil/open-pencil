import type { ImageFilter, MaskFilter, Canvas, Paint, Path } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import * as Effects from '#core/canvas/effects'
import * as Fills from '#core/canvas/fills'
import * as Labels from '#core/canvas/labels/draw'
import * as NodeEditOverlay from '#core/canvas/node-edit-overlay'
import * as Overlays from '#core/canvas/overlays'
import * as PenOverlay from '#core/canvas/pen-overlay'
import type { SkiaRenderer } from '#core/canvas/renderer'
import type { PresenceCursor, RenderOverlays } from '#core/canvas/renderer/types'
import * as Rulers from '#core/canvas/rulers'
import * as SceneRender from '#core/canvas/scene'
import { type EffectPass, renderEffects as renderShadowEffects } from '#core/canvas/shadows'
import * as Shapes from '#core/canvas/shapes'
import * as Strokes from '#core/canvas/strokes'
import { drawIndividualSideStrokes } from '#core/canvas/strokes/sides'
import type { TextEditor } from '#core/text/editor'

const rendererMethods = {
  drawHoverHighlight(
    canvas: Canvas,
    graph: SceneGraph,
    hoveredNodeId?: string | null,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawHoverHighlight(this, canvas, graph, hoveredNodeId, preview)
  },

  drawMeasurements(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    targetId?: string | null
  ): void {
    Overlays.drawMeasurements(this, canvas, graph, selectedIds, targetId)
  },

  drawEnteredContainer(
    canvas: Canvas,
    graph: SceneGraph,
    enteredContainerId?: string | null,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawEnteredContainer(this, canvas, graph, enteredContainerId, preview)
  },

  drawSelection(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays
  ): void {
    Overlays.drawSelection(this, canvas, graph, selectedIds, overlays)
  },

  drawNodeSelection(
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawNodeSelection(this, canvas, node, rotation, graph, preview)
  },

  drawSelectionLabels(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays?: RenderOverlays
  ): void {
    Overlays.drawSelectionLabels(this, canvas, graph, selectedIds, overlays)
  },

  drawParentFrameOutlines(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawParentFrameOutlines(this, canvas, graph, selectedIds, preview)
  },

  drawNodeOutline(
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawNodeOutline(this, canvas, node, rotation, graph, preview)
  },

  drawGroupBounds(
    canvas: Canvas,
    nodes: SceneNode[],
    graph: SceneGraph,
    preview?: RenderOverlays['rotationPreview']
  ): void {
    Overlays.drawGroupBounds(this, canvas, nodes, graph, preview)
  },

  drawHandle(canvas: Canvas, x: number, y: number): void {
    Overlays.drawHandle(this, canvas, x, y)
  },

  drawSnapGuides(canvas: Canvas, guides?: SnapGuide[]): void {
    Overlays.drawSnapGuides(this, canvas, guides)
  },

  drawSnapMarks(canvas: Canvas, guides?: SnapGuide[]): void {
    Overlays.drawSnapMarks(this, canvas, guides)
  },

  drawMarquee(canvas: Canvas, marquee?: Rect | null): void {
    Overlays.drawMarquee(this, canvas, marquee)
  },

  drawFlashes(canvas: Canvas, graph: SceneGraph): void {
    Overlays.drawFlashes(this, canvas, graph)
  },

  drawLayoutInsertIndicator(
    canvas: Canvas,
    indicator?: RenderOverlays['layoutInsertIndicator']
  ): void {
    Overlays.drawLayoutInsertIndicator(this, canvas, indicator)
  },

  drawAutoLayoutHover(
    canvas: Canvas,
    graph: SceneGraph,
    hover?: RenderOverlays['autoLayoutHover']
  ) {
    Overlays.drawAutoLayoutHover(this, canvas, graph, hover)
  },

  drawTextEditOverlay(canvas: Canvas, node: SceneNode, editor: TextEditor, outset = 0): void {
    Overlays.drawTextEditOverlay(this, canvas, node, editor, outset)
  },

  drawNodeEditOverlay(
    canvas: Canvas,
    graph: SceneGraph,
    editState: RenderOverlays['nodeEditState']
  ): void {
    NodeEditOverlay.drawNodeEditOverlay(this, canvas, graph, editState)
  },

  drawPenOverlay(canvas: Canvas, penState: RenderOverlays['penState']): void {
    PenOverlay.drawPenOverlay(this, canvas, penState)
  },

  drawPencilOverlay(canvas: Canvas, pencilState: RenderOverlays['pencilState']): void {
    PenOverlay.drawPencilOverlay(this, canvas, pencilState)
  },

  drawPresenceCursors(canvas: Canvas, graph: SceneGraph, cursors?: PresenceCursor[]): void {
    Overlays.drawPresenceCursors(this, canvas, graph, cursors)
  },

  drawRulers(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    guides?: RenderOverlays['guides']
  ): void {
    Rulers.drawRulers(this, canvas, graph, selectedIds, guides)
  },

  drawFrameTitles(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: ReadonlySet<string>,
    overlays?: RenderOverlays
  ): void {
    Labels.drawFrameTitles(this, canvas, graph, selectedIds, overlays)
  },

  drawSectionTitles(canvas: Canvas, graph: SceneGraph, overlays?: RenderOverlays): void {
    Labels.drawSectionTitles(this, canvas, graph, overlays)
  },

  drawComponentLabels(canvas: Canvas, graph: SceneGraph, overlays?: RenderOverlays): void {
    Labels.drawComponentLabels(this, canvas, graph, overlays)
  },

  renderNodeSelf(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays?: RenderOverlays
  ): void {
    SceneRender.renderNodeSelf(this, canvas, graph, nodeId, overlays)
  },

  renderNode(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays,
    parentAbsX?: number,
    parentAbsY?: number,
    frame?: Mat3 | null
  ): void {
    SceneRender.renderNode(this, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY, frame)
  },

  renderSection(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    SceneRender.renderSection(this, canvas, node, graph)
  },

  renderComponentSet(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    SceneRender.renderComponentSet(this, canvas, node, graph)
  },

  renderShape(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    SceneRender.renderShape(this, canvas, node, graph)
  },

  renderShapeUncached(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    SceneRender.renderShapeUncached(this, canvas, node, graph)
  },

  paintShapeContent(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    SceneRender.paintShapeContent(this, canvas, node, graph)
  },

  renderEffects(canvas: Canvas, node: SceneNode, graph: SceneGraph, pass: EffectPass): void {
    renderShadowEffects(this, canvas, node, graph, pass)
  },

  renderText(canvas: Canvas, node: SceneNode, fill?: Fill): void {
    SceneRender.renderText(this, canvas, node, fill)
  },

  drawNodeFill(canvas: Canvas, node: SceneNode, fill?: Fill): void {
    Fills.drawNodeFill(this, canvas, node, fill)
  },

  applyFill(fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex = 0): boolean {
    return Fills.applyFill(this, fill, node, graph, fillIndex)
  },

  applyGradientFill(fill: Fill, node: SceneNode, graph: SceneGraph): boolean {
    return Fills.applyGradientFill(this, fill, node, graph)
  },

  applyImageFill(fill: Fill, node: SceneNode, graph: SceneGraph): boolean {
    return Fills.applyImageFill(this, fill, node, graph)
  },

  drawNodeStroke(canvas: Canvas, node: SceneNode): void {
    Strokes.drawNodeStroke(this, canvas, node)
  },

  drawStrokeWithAlign(
    canvas: Canvas,
    node: SceneNode,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ): void {
    Strokes.drawStrokeWithAlign(this, canvas, node, align)
  },

  drawRRectStrokeWithAlign(
    canvas: Canvas,
    rrect: Float32Array,
    node: SceneNode,
    stroke: Stroke
  ): void {
    Strokes.drawRRectStrokeWithAlign(this, canvas, rrect, node, stroke)
  },

  drawIndividualSideStrokes(canvas: Canvas, node: SceneNode, stroke: Stroke): void {
    drawIndividualSideStrokes(this, canvas, node, stroke)
  },

  strokeNodeShape(canvas: Canvas, node: SceneNode, paint: Paint): void {
    Strokes.strokeNodeShape(this, canvas, node, paint)
  },

  makeNodeShapePath(node: SceneNode): Path {
    return Shapes.makeNodeShapePath(this, node)
  },

  makePolygonPath(node: SceneNode): Path {
    return Shapes.makePolygonPath(this, node)
  },

  makeRRect(node: SceneNode): Float32Array {
    return Shapes.makeRRect(this, node)
  },

  makeRRectWithSpread(node: SceneNode, spread: number): Float32Array {
    return Shapes.makeRRectWithSpread(this, node, spread)
  },

  clipNodeShape(canvas: Canvas, node: SceneNode): void {
    Shapes.clipNodeShape(this, canvas, node)
  },

  getVectorPaths(node: SceneNode): Path[] | null {
    return Shapes.getVectorPaths(this, node)
  },

  getFillGeometry(node: SceneNode): Path[] | null {
    return Shapes.getFillGeometry(this, node)
  },

  getStrokeGeometry(node: SceneNode): Path[] | null {
    return Shapes.getStrokeGeometry(this, node)
  },

  getCachedDropShadow(
    dx: number,
    dy: number,
    sigma: number,
    color: Float32Array
  ): ImageFilter | null {
    return Effects.getCachedDropShadow(this, dx, dy, sigma, color)
  },

  getCachedBlur(sigma: number): ImageFilter | null {
    return Effects.getCachedBlur(this, sigma)
  },

  getCachedDecalBlur(sigma: number): ImageFilter | null {
    return Effects.getCachedDecalBlur(this, sigma)
  },

  getCachedMaskBlur(sigma: number): MaskFilter | null {
    return Effects.getCachedMaskBlur(this, sigma)
  },

  applyClippedBlur(canvas: Canvas, node: SceneNode, sigma: number, shape?: Path | null): void {
    Effects.applyClippedBlur(this, canvas, node, sigma, shape)
  }
} satisfies ThisType<SkiaRenderer>

export type RendererDomainMethods = typeof rendererMethods

export function installRendererDomainMethods(prototype: object): void {
  Object.assign(prototype, rendererMethods)
}
