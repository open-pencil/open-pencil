import * as AiOverlays from '#core/canvas/ai-overlays'
import * as Effects from '#core/canvas/effects'
import * as Fills from '#core/canvas/fills'
import * as Labels from '#core/canvas/labels/draw'
import * as NodeEditOverlay from '#core/canvas/node-edit-overlay'
import * as Overlays from '#core/canvas/overlays'
import * as PenOverlay from '#core/canvas/pen-overlay'
import * as Rulers from '#core/canvas/rulers'
import * as SceneRender from '#core/canvas/scene'
import * as Shapes from '#core/canvas/shapes'
import * as Strokes from '#core/canvas/strokes'
import type { Fill, SceneGraph, SceneNode, Stroke } from '#core/scene-graph'
import type { SnapGuide } from '#core/scene-graph/snap'
import type { TextEditor } from '#core/text/editor'
import type { Rect, Vector } from '#core/types'
import type { ImageFilter, MaskFilter, Canvas, Paint, Path } from 'canvaskit-wasm'
import type { NodeEditOverlayState } from '#core/canvas/node-edit-overlay'
import type { RenderOverlays } from '#core/canvas/renderer/types'
import type { SkiaRenderer } from '#core/canvas/renderer'

const rendererMethods: ThisType<SkiaRenderer> = {
drawHoverHighlight(
  canvas: Canvas,
  graph: SceneGraph,
  hoveredNodeId?: string | null
): void {
  Overlays.drawHoverHighlight(this, canvas, graph, hoveredNodeId)
},

drawEnteredContainer(
  canvas: Canvas,
  graph: SceneGraph,
  enteredContainerId?: string | null
): void {
  Overlays.drawEnteredContainer(this, canvas, graph, enteredContainerId)
},

drawSelection(
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  Overlays.drawSelection(this, canvas, graph, selectedIds, overlays)
},

drawNodeSelection(canvas: Canvas, node: SceneNode, rotation: number, graph: SceneGraph): void {
  Overlays.drawNodeSelection(this, canvas, node, rotation, graph)
},

drawSelectionLabels(
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays?: RenderOverlays
): void {
  Overlays.drawSelectionLabels(this, canvas, graph, selectedIds, overlays)
},

drawParentFrameOutlines(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
  Overlays.drawParentFrameOutlines(this, canvas, graph, selectedIds)
},

drawNodeOutline(canvas: Canvas, node: SceneNode, rotation: number, graph: SceneGraph): void {
  Overlays.drawNodeOutline(this, canvas, node, rotation, graph)
},

drawGroupBounds(canvas: Canvas, nodes: SceneNode[], graph: SceneGraph): void {
  Overlays.drawGroupBounds(this, canvas, nodes, graph)
},

getRotatedCorners(n: SceneNode, abs: Vector): Vector[] {
  return Overlays.getRotatedCorners(this, n, abs)
},

drawHandle(canvas: Canvas, x: number, y: number): void {
  Overlays.drawHandle(this, canvas, x, y)
},

drawSnapGuides(canvas: Canvas, guides?: SnapGuide[]): void {
  Overlays.drawSnapGuides(this, canvas, guides)
},

drawMarquee(canvas: Canvas, marquee?: Rect | null): void {
  Overlays.drawMarquee(this, canvas, marquee)
},

drawFlashes(canvas: Canvas, graph: SceneGraph): void {
  Overlays.drawFlashes(this, canvas, graph)
  AiOverlays.drawAiOverlays(this, canvas, graph)
},

drawLayoutInsertIndicator(
  canvas: Canvas,
  indicator?: RenderOverlays['layoutInsertIndicator']
): void {
  Overlays.drawLayoutInsertIndicator(this, canvas, indicator)
},

drawTextEditOverlay(canvas: Canvas, node: SceneNode, editor: TextEditor): void {
  Overlays.drawTextEditOverlay(this, canvas, node, editor)
},

drawNodeEditOverlay(
  canvas: Canvas,
  graph: SceneGraph,
  editState: RenderOverlays['nodeEditState']
): void {
  NodeEditOverlay.drawNodeEditOverlay(this, canvas, graph, editState as NodeEditOverlayState | null)
},

drawPenOverlay(canvas: Canvas, penState: RenderOverlays['penState']): void {
  PenOverlay.drawPenOverlay(this, canvas, penState)
},

drawRemoteCursors(
  canvas: Canvas,
  graph: SceneGraph,
  cursors?: RenderOverlays['remoteCursors']
): void {
  PenOverlay.drawRemoteCursors(this, canvas, graph, cursors)
},

drawRulers(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
  Rulers.drawRulers(this, canvas, graph, selectedIds)
},

drawSectionTitles(canvas: Canvas, graph: SceneGraph): void {
  Labels.drawSectionTitles(this, canvas, graph)
},

drawComponentLabels(canvas: Canvas, graph: SceneGraph): void {
  Labels.drawComponentLabels(this, canvas, graph)
},

renderNode(canvas: Canvas, graph: SceneGraph, nodeId: string, overlays: RenderOverlays): void {
  SceneRender.renderNode(this, canvas, graph, nodeId, overlays)
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

renderEffects(
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  pass: 'behind' | 'front',
  shadowShapeChild?: SceneNode | null
): void {
  Effects.renderEffects(this, canvas, node, rect, hasRadius, pass, shadowShapeChild)
},

renderText(canvas: Canvas, node: SceneNode): void {
  SceneRender.renderText(this, canvas, node)
},

drawNodeFill(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
  Fills.drawNodeFill(this, canvas, node, rect, hasRadius)
},

applyFill(fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex = 0): boolean {
  return Fills.applyFill(this, fill, node, graph, fillIndex)
},

applyGradientFill(fill: Fill, node: SceneNode, graph: SceneGraph): void {
  Fills.applyGradientFill(this, fill, node, graph)
},

applyImageFill(fill: Fill, node: SceneNode, graph: SceneGraph): boolean {
  return Fills.applyImageFill(this, fill, node, graph)
},

drawArc(canvas: Canvas, node: SceneNode, paint: Paint): void {
  Fills.drawArc(this, canvas, node, paint)
},

drawNodeStroke(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
  Strokes.drawNodeStroke(this, canvas, node, rect, hasRadius)
},

drawStrokeWithAlign(
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  Strokes.drawStrokeWithAlign(this, canvas, node, rect, hasRadius, align)
},

drawRRectStrokeWithAlign(
  canvas: Canvas,
  rrect: Float32Array,
  node: SceneNode,
  stroke: Stroke
): void {
  Strokes.drawRRectStrokeWithAlign(this, canvas, rrect, node, stroke)
},

drawIndividualSideStrokes(
  canvas: Canvas,
  node: SceneNode,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
): void {
  Strokes.drawIndividualSideStrokes(this, canvas, node, align)
},

strokeNodeShape(canvas: Canvas, node: SceneNode, paint: Paint): void {
  Strokes.strokeNodeShape(this, canvas, node, paint)
},

makeNodeShapePath(node: SceneNode, rect: Float32Array, hasRadius: boolean): Path {
  return Shapes.makeNodeShapePath(this, node, rect, hasRadius)
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

makeRRectWithOffset(node: SceneNode, ox: number, oy: number, spread: number): Float32Array {
  return Shapes.makeRRectWithOffset(this, node, ox, oy, spread)
},

clipNodeShape(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
  Shapes.clipNodeShape(this, canvas, node, rect, hasRadius)
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

getCachedDropShadow(dx: number, dy: number, sigma: number, color: Float32Array): ImageFilter {
  return Effects.getCachedDropShadow(this, dx, dy, sigma, color)
},

getCachedBlur(sigma: number): ImageFilter {
  return Effects.getCachedBlur(this, sigma)
},

getCachedDecalBlur(sigma: number): ImageFilter {
  return Effects.getCachedDecalBlur(this, sigma)
},

getCachedMaskBlur(sigma: number): MaskFilter {
  return Effects.getCachedMaskBlur(this, sigma)
},

applyClippedBlur(
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  sigma: number
): void {
  Effects.applyClippedBlur(this, canvas, node, rect, hasRadius, sigma)
}
}

export function installRendererDomainMethods(prototype: object): void {
  Object.assign(prototype, rendererMethods)
}
