/* eslint-disable max-lines -- SkiaRenderer facade owns CanvasKit state and delegates domain drawing */
import {
  SELECTION_COLOR,
  COMPONENT_COLOR,
  CANVAS_BG_COLOR,
  DEFAULT_FONT_SIZE,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  IS_BROWSER
} from '#core/constants'
import { RenderProfiler } from '#core/profiler'

import { LabelCache } from './labels/cache'
import * as LabelHitTest from './labels/hit-test'
import * as RenderColors from './renderer/colors'
import * as RendererFonts from './renderer/fonts'
import { destroyRenderer } from './renderer/lifecycle'
import { installRendererDomainMethods } from './renderer/methods'
import { initializeRendererPaints } from './renderer/paints'
import * as RenderPipeline from './renderer/pipeline'
import * as RendererState from './renderer/state'
import * as RenderText from './text'

import type { ResolvedRenderColor } from '#core/color/management'
import type { EditorState } from '#core/editor/types'
import type { SceneNode, SceneGraph, Fill, Stroke } from '#core/scene-graph'
import type { SnapGuide } from '#core/scene-graph/snap'
import type { TextEditor } from '#core/text/editor'
import type { Color, Rect, Vector } from '#core/types'
export type { RenderOverlays, RulerTheme } from './renderer/types'
import type { RenderOverlays, RulerTheme } from './renderer/types'
import type {
  Image as CKImage,
  Path,
  CanvasKit,
  Surface,
  Canvas,
  Paint,
  Font,
  FontMgr,
  TypefaceFontProvider,
  SkPicture,
  ImageFilter,
  MaskFilter,
  Paragraph
} from 'canvaskit-wasm'

export class SkiaRenderer {
  ck: CanvasKit
  surface: Surface
  declare fillPaint: Paint
  declare strokePaint: Paint
  declare selectionPaint: Paint
  declare parentOutlinePaint: Paint
  declare snapPaint: Paint
  declare auxFill: Paint
  declare auxStroke: Paint
  declare opacityPaint: Paint
  declare effectLayerPaint: Paint
  imageFilterCache = new Map<string, ImageFilter | null>()
  maskFilterCache = new Map<number, MaskFilter | null>()
  _tmpColor = new Float32Array(4)
  _tmpRect = new Float32Array(4)
  textFont: Font | null = null
  labelFont: Font | null = null
  sizeFont: Font | null = null
  sectionTitleFont: Font | null = null
  componentLabelFont: Font | null = null
  fontMgr: FontMgr | null = null
  fontProvider: TypefaceFontProvider | null = null
  fontsLoaded = false
  imageCache = new Map<string, CKImage>()
  vectorPathCache = new Map<string, Path[]>()
  fillGeometryCache = new Map<string, Path[]>()
  strokeGeometryCache = new Map<string, Path[]>()
  scenePicture: SkPicture | null = null
  scenePictureVersion = -1
  scenePicturePageId: string | null = null
  lastObservedSceneVersion = -1
  lastSceneVersionChangeAt = 0
  nodePictureCache = new Map<string, SkPicture | null>()
  readonly labelCache = new LabelCache()
  readonly profiler: RenderProfiler

  declare rulerBgPaint: Paint
  declare rulerTickPaint: Paint
  declare rulerTextPaint: Paint
  declare rulerHlPaint: Paint
  declare rulerBadgePaint: Paint
  declare rulerLabelPaint: Paint
  declare penPathPaint: Paint
  declare penLiveStrokePaint: Paint
  declare penHandlePaint: Paint
  declare penVertexFill: Paint
  declare penVertexStroke: Paint

  panX = 0
  panY = 0
  zoom = 1
  dpr = 1
  viewportWidth = 0
  viewportHeight = 0
  showRulers = true
  pageColor = CANVAS_BG_COLOR
  rulerTheme: RulerTheme | null = null
  pageId: string | null = null

  worldViewport = { x: 0, y: 0, w: 0, h: 0 }
  _nodeCount = 0
  _culledCount = 0
  _flashes: Array<{ nodeId: string; startTime: number }> = []
  _flashPaint: Paint | null = null
  _aiActiveNodes: Set<string> = new Set()
  _aiDoneFlashes: Array<{ nodeId: string; startTime: number }> = []

  readonly DEFAULT_FONT_SIZE = DEFAULT_FONT_SIZE
  readonly COMPONENT_SET_BORDER_WIDTH = COMPONENT_SET_BORDER_WIDTH
  readonly COMPONENT_SET_DASH = COMPONENT_SET_DASH
  readonly COMPONENT_SET_DASH_GAP = COMPONENT_SET_DASH_GAP

  declare drawHoverHighlight: (
    canvas: Canvas,
    graph: SceneGraph,
    hoveredNodeId?: string | null
  ) => void
  declare drawEnteredContainer: (
    canvas: Canvas,
    graph: SceneGraph,
    enteredContainerId?: string | null
  ) => void
  declare drawSelection: (
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays
  ) => void
  declare drawNodeSelection: (
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph
  ) => void
  declare drawSelectionLabels: (
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays?: RenderOverlays
  ) => void
  declare drawParentFrameOutlines: (
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>
  ) => void
  declare drawNodeOutline: (
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph
  ) => void
  declare drawGroupBounds: (canvas: Canvas, nodes: SceneNode[], graph: SceneGraph) => void
  declare getRotatedCorners: (node: SceneNode, abs: Vector) => Vector[]
  declare drawHandle: (canvas: Canvas, x: number, y: number) => void
  declare drawSnapGuides: (canvas: Canvas, guides?: SnapGuide[]) => void
  declare drawMarquee: (canvas: Canvas, marquee?: Rect | null) => void
  declare drawFlashes: (canvas: Canvas, graph: SceneGraph) => void
  declare drawLayoutInsertIndicator: (
    canvas: Canvas,
    indicator?: RenderOverlays['layoutInsertIndicator']
  ) => void
  declare drawTextEditOverlay: (canvas: Canvas, node: SceneNode, editor: TextEditor) => void
  declare drawNodeEditOverlay: (
    canvas: Canvas,
    graph: SceneGraph,
    editState?: RenderOverlays['nodeEditState']
  ) => void
  declare drawPenOverlay: (canvas: Canvas, penState: RenderOverlays['penState']) => void
  declare drawRemoteCursors: (
    canvas: Canvas,
    graph: SceneGraph,
    cursors?: RenderOverlays['remoteCursors']
  ) => void
  declare drawRulers: (canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>) => void
  declare drawSectionTitles: (canvas: Canvas, graph: SceneGraph) => void
  declare drawComponentLabels: (canvas: Canvas, graph: SceneGraph) => void
  declare renderNode: (
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays
  ) => void
  declare renderSection: (canvas: Canvas, node: SceneNode, graph: SceneGraph) => void
  declare renderComponentSet: (canvas: Canvas, node: SceneNode, graph: SceneGraph) => void
  declare renderShape: (canvas: Canvas, node: SceneNode, graph: SceneGraph) => void
  declare renderShapeUncached: (canvas: Canvas, node: SceneNode, graph: SceneGraph) => void
  declare renderEffects: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    pass: 'behind' | 'front',
    shadowShapeChild?: SceneNode | null
  ) => void
  declare renderText: (canvas: Canvas, node: SceneNode, fill?: Fill) => void
  declare drawNodeFill: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    fill?: Fill
  ) => void
  declare applyFill: (fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex?: number) => boolean
  declare applyGradientFill: (fill: Fill, node: SceneNode, graph: SceneGraph) => void
  declare applyImageFill: (fill: Fill, node: SceneNode, graph: SceneGraph) => boolean
  declare drawArc: (canvas: Canvas, node: SceneNode, paint: Paint) => void
  declare drawNodeStroke: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean
  ) => void
  declare drawStrokeWithAlign: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ) => void
  declare drawRRectStrokeWithAlign: (
    canvas: Canvas,
    rrect: Float32Array,
    node: SceneNode,
    stroke: Stroke
  ) => void
  declare drawIndividualSideStrokes: (
    canvas: Canvas,
    node: SceneNode,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ) => void
  declare strokeNodeShape: (canvas: Canvas, node: SceneNode, paint: Paint) => void
  declare makeNodeShapePath: (node: SceneNode, rect: Float32Array, hasRadius: boolean) => Path
  declare makePolygonPath: (node: SceneNode) => Path
  declare makeRRect: (node: SceneNode) => Float32Array
  declare makeRRectWithSpread: (node: SceneNode, spread: number) => Float32Array
  declare makeRRectWithOffset: (
    node: SceneNode,
    ox: number,
    oy: number,
    spread: number
  ) => Float32Array
  declare clipNodeShape: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean
  ) => void
  declare getVectorPaths: (node: SceneNode) => Path[] | null
  declare getFillGeometry: (node: SceneNode) => Path[] | null
  declare getStrokeGeometry: (node: SceneNode) => Path[] | null
  declare getCachedDropShadow: (
    dx: number,
    dy: number,
    sigma: number,
    color: Float32Array
  ) => ImageFilter
  declare getCachedBlur: (sigma: number) => ImageFilter
  declare getCachedDecalBlur: (sigma: number) => ImageFilter
  declare getCachedMaskBlur: (sigma: number) => MaskFilter
  declare applyClippedBlur: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    sigma: number
  ) => void
  color4f(r: number, g: number, b: number, a: number): Float32Array {
    const c = this._tmpColor
    c[0] = r
    c[1] = g
    c[2] = b
    c[3] = a
    return c
  }

  ltrb(l: number, t: number, r: number, b: number): Float32Array {
    const rc = this._tmpRect
    rc[0] = l
    rc[1] = t
    rc[2] = r
    rc[3] = b
    return rc
  }

  selColor(alpha = 1) {
    return this.ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, alpha)
  }

  compColor(alpha = 1) {
    return this.ck.Color4f(COMPONENT_COLOR.r, COMPONENT_COLOR.g, COMPONENT_COLOR.b, alpha)
  }

  isComponentType(type: string): boolean {
    return type === 'COMPONENT' || type === 'COMPONENT_SET' || type === 'INSTANCE'
  }

  isRectangularType(type: string): boolean {
    return (
      type === 'FRAME' ||
      type === 'RECTANGLE' ||
      type === 'ROUNDED_RECTANGLE' ||
      type === 'COMPONENT' ||
      type === 'INSTANCE' ||
      type === 'SECTION' ||
      type === 'GROUP'
    )
  }

  effectOverflow(node: SceneNode): number {
    let expand = 0
    for (const e of node.effects) {
      if (!e.visible) continue
      const blur = e.radius
      const spread = e.spread
      const ox = Math.abs(e.offset.x)
      const oy = Math.abs(e.offset.y)
      expand = Math.max(expand, blur + spread + ox, blur + spread + oy)
    }
    return expand
  }

  constructor(ck: CanvasKit, surface: Surface, gl?: WebGL2RenderingContext | null) {
    this.ck = ck
    this.surface = surface
    this.profiler = new RenderProfiler(ck, gl ?? null)
    initializeRendererPaints(this)
  }

  getFontProvider(): TypefaceFontProvider | null {
    return RendererFonts.getFontProvider(this)
  }

  isDestroyed(): boolean {
    return this.destroyed
  }

  async loadFonts(): Promise<void> {
    await RendererFonts.loadFonts(this)
  }

  async prepareForExport(
    graph: SceneGraph,
    pageId: string,
    nodeIds: string[]
  ): Promise<() => void> {
    return RendererFonts.prepareForExport(this, graph, pageId, nodeIds)
  }

  replaceSurface(surface: Surface): void {
    this.surface.delete()
    this.surface = surface
    this.invalidateScenePicture()
  }

  invalidateScenePicture(): void {
    RendererState.invalidateScenePicture(this)
  }

  invalidateAllPictures(): void {
    RendererState.invalidateAllPictures(this)
  }

  invalidateNodePicture(nodeId: string): void {
    RendererState.invalidateNodePicture(this, nodeId)
  }

  flashNode(nodeId: string): void {
    RendererState.flashNode(this, nodeId)
  }

  aiMarkActive(nodeIds: string[]): void {
    RendererState.aiMarkActive(this, nodeIds)
  }

  aiMarkDone(nodeIds: string[]): void {
    RendererState.aiMarkDone(this, nodeIds)
  }

  aiFlashDone(nodeIds: string[]): void {
    RendererState.aiFlashDone(this, nodeIds)
  }

  aiClearActive(): void {
    RendererState.aiClearActive(this)
  }

  aiClearAll(): void {
    RendererState.aiClearAll(this)
  }

  get hasActiveFlashes(): boolean {
    return RendererState.hasActiveFlashes(this)
  }

  hitTestSectionTitle(graph: SceneGraph, canvasX: number, canvasY: number): SceneNode | null {
    return LabelHitTest.hitTestSectionTitle(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.sectionTitleFont
    )
  }

  hitTestComponentLabel(graph: SceneGraph, canvasX: number, canvasY: number): SceneNode | null {
    return LabelHitTest.hitTestComponentLabel(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.componentLabelFont
    )
  }

  hitTestFrameTitle(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    selectedIds: Set<string>
  ): SceneNode | null {
    return LabelHitTest.hitTestFrameTitle(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      selectedIds,
      this.labelFont
    )
  }

  renderSceneToCanvas(canvas: Canvas, graph: SceneGraph, pageId: string): void {
    RenderPipeline.renderSceneToCanvas(this, canvas, graph, pageId)
  }

  renderFromEditorState(
    state: EditorState,
    graph: SceneGraph,
    textEditor: unknown,
    viewportWidth: number,
    viewportHeight: number,
    showRulers = true,
    layer: RenderPipeline.RenderLayer = 'full'
  ): void {
    const dpr = IS_BROWSER ? window.devicePixelRatio || 1 : 1
    RenderPipeline.renderFromEditorState(
      this,
      state,
      graph,
      textEditor,
      viewportWidth,
      viewportHeight,
      showRulers,
      dpr,
      layer
    )
  }

  render(
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays = {},
    sceneVersion = -1,
    layer: RenderPipeline.RenderLayer = 'full'
  ): void {
    RenderPipeline.render(this, graph, selectedIds, overlays, sceneVersion, layer)
  }

  invalidateVectorPath(nodeId: string): void {
    const old = this.vectorPathCache.get(nodeId)
    if (old) {
      for (const p of old) p.delete()
      this.vectorPathCache.delete(nodeId)
    }
    for (const cache of [this.fillGeometryCache, this.strokeGeometryCache]) {
      const oldGeom = cache.get(nodeId)
      if (oldGeom) {
        for (const p of oldGeom) p.delete()
        cache.delete(nodeId)
      }
    }
  }

  measureTextNode(node: SceneNode, maxWidth?: number): { width: number; height: number } | null {
    return RenderText.measureTextNode(this, node, maxWidth)
  }

  isNodeFontLoaded(node: SceneNode): boolean {
    return RenderText.isNodeFontLoaded(this, node)
  }

  buildTextPicture(node: SceneNode): Uint8Array | null {
    return RenderText.buildTextPicture(this, node)
  }

  buildParagraph(
    node: SceneNode,
    color?: Float32Array,
    opts?: { halfLeading?: boolean }
  ): Paragraph {
    return RenderText.buildParagraph(this, node, color, opts)
  }

  resolveFillColorInfo(
    fill: Fill,
    fillIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    return RenderColors.resolveFillColorInfo(fill, fillIndex, node, graph)
  }

  resolveFillColor(fill: Fill, fillIndex: number, node: SceneNode, graph: SceneGraph): Color {
    return RenderColors.resolveFillColor(fill, fillIndex, node, graph)
  }

  resolveStrokeColorInfo(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    return RenderColors.resolveStrokeColorInfo(stroke, strokeIndex, node, graph)
  }

  resolveStrokeColor(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): Color {
    return RenderColors.resolveStrokeColor(stroke, strokeIndex, node, graph)
  }

  screenToCanvas(sx: number, sy: number): Vector {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    }
  }

  destroyed: boolean = false

  destroy(): void {
    destroyRenderer(this)
  }
}

installRendererDomainMethods(SkiaRenderer.prototype)
