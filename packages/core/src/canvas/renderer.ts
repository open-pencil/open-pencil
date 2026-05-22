import type { ResolvedRenderColor } from '#core/color/management'
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
import type { EditorState } from '#core/editor/types'
import { LRUMap } from '#core/lru-map'
import { RenderProfiler } from '#core/profiler'
import type {
  SceneNode,
  SceneGraph,
  Fill,
  GradientFill,
  ImageFill,
  Stroke
} from '#core/scene-graph'
import type { SnapGuide } from '#core/scene-graph/snap'
import type { TextEditor } from '#core/text/editor'
import type { Color, Rect, Vector } from '#core/types'

import type { AbsPosFullInfo } from './coordinate'
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
export type { RenderOverlays, RulerTheme } from './renderer/types'
import type {
  Image as CKImage,
  Path,
  PathEffect,
  CanvasKit,
  Surface,
  Canvas,
  Paint,
  Font,
  FontMgr,
  TypefaceFontProvider,
  Shader,
  SkPicture,
  ImageFilter,
  MaskFilter,
  Paragraph
} from 'canvaskit-wasm'

export interface SubtreePictureCacheEntry {
  picture: SkPicture
  pageId: string | null
  sceneVersion: number
  positionPreviewVersion: number
}

import type { ShaderCacheEntry } from './renderer/shader-cache-entry'
import type { RenderOverlays, RulerTheme } from './renderer/types'

export class SkiaRenderer {
  ck: CanvasKit
  surface: Surface
  declare fillPaint: Paint
  declare strokePaint: Paint
  declare selectionPaint: Paint
  declare parentOutlinePaint: Paint
  declare parentOutlineDashEffect: PathEffect
  declare snapPaint: Paint
  declare auxFill: Paint
  declare auxStroke: Paint
  declare opacityPaint: Paint
  declare effectLayerPaint: Paint
  imageFilterCache = new LRUMap<string, ImageFilter | null>(100)
  maskFilterCache = new LRUMap<number, MaskFilter | null>(100)
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
  requestRepaint?: () => void
  imageCache = new LRUMap<string, CKImage>(200)
  vectorPathCache = new LRUMap<string, Path[]>(500)
  vectorStrokePathCache = new LRUMap<string, Path[]>(200)
  vectorStrokeOutlineCache = new LRUMap<string, Path[]>(200)
  fillGeometryCache = new LRUMap<string, Path[]>(500)
  strokeGeometryCache = new LRUMap<string, Path[]>(500)
  scenePicture: SkPicture | null = null
  scenePictureVersion = -1
  scenePicturePositionPreviewVersion = -1
  scenePicturePageId: string | null = null
  sceneBacking: {
    image: CKImage
    pageId: string | null
    sceneVersion: number
    positionPreviewVersion: number
    panX: number
    panY: number
    zoom: number
    width: number
    height: number
    dpr: number
    worldX: number
    worldY: number
    worldWidth: number
    worldHeight: number
  } | null = null
  sceneBackingPreviewUntil = 0
  sceneBackingNeedsCrispRender = false
  sceneBackingBuild: {
    surface: Surface
    graph: SceneGraph
    childIds: string[]
    index: number
    startedAt: number
    pageId: string | null
    sceneVersion: number
    positionPreviewVersion: number
    panX: number
    panY: number
    zoom: number
    width: number
    height: number
    dpr: number
    worldX: number
    worldY: number
    worldWidth: number
    worldHeight: number
  } | null = null
  sceneBackingAverageRecordMs = 40
  sceneBackingAverageViewportIntervalMs = 80
  sceneBackingLastViewportEventAt = 0
  lastSceneViewport: { panX: number; panY: number; zoom: number } | null = null
  subtreePictureCache = new Map<string, SubtreePictureCacheEntry>()
  subtreePictureCachePageId: string | null = null
  subtreePictureCacheSceneVersion = -1
  subtreePictureCachePositionPreviewVersion = -1
  lastObservedSceneVersion = -1
  lastSceneVersionChangeAt = 0
  /** Cached countDescendants result, invalidated when sceneVersion changes */
  _cachedLargeGraphVersion = -1
  _cachedLargeGraphResult = false
  _cachedLargeGraphPageId: string | null = null
  /** Cached getAbsolutePositionFull results, invalidated when sceneVersion or pageId changes */
  _absPosFullCache = new Map<string, AbsPosFullInfo>()
  _absPosFullSceneVersion = -1
  _absPosFullPageId: string | null = null
  /** Current node's absInfo during renderNode execution — used by LOD metric
   * functions (effectLodScreenMetric, tryRenderTextLOD) to compute world-space
   * screen area instead of local node dimensions. Saved and restored across
   * recursive renderNode calls so each frame maintains the parent's value.
   * Null when no renderNode is active (top-level or between frames). */
  _currentAbsInfo: AbsPosFullInfo | null = null
  nodePictureCache = new LRUMap<string, SkPicture | null>(500)
  shaderCache = new LRUMap<number, ShaderCacheEntry[]>(200)
  imageFillShader: Shader | null = null
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
  _lodCulledCount = 0

  /**
   * Minimum screen-space area (in px²) below which nodes are skipped.
   * Nodes whose on-screen bounding box area is less than this value are
   * not rendered — their fills, strokes, effects, and children are all
   * skipped. This is a Level-of-Detail optimization for zoomed-out views.
   *
   * Default 4 (2×2 CSS px on screen). Nodes smaller than this are
   * perceptually negligible — even on high-DPI displays, a 2×2 CSS px
   * square occupies only 4×4 physical pixels at 2× Retina, which is
   * indistinguishable from rendering artifacts at normal viewing distance.
   * Set to 0 to force full fidelity at all zoom levels (useful for tests
   * or screenshots).
   *
   * Structural nodes (SECTION, COMPONENT_SET, containers with children,
   * nodes with visible effects) are never LOD-culled regardless of size.
   *
   * Memory impact: ZERO — no additional caches or data structures.
   * CPU impact: One float multiply + compare per visible node.
   */
  minScreenSize = 4

  /**
   * Minimum base-LOD threshold applied while the viewport is actively
   * panning or zooming, independent of the idle `minScreenSize` setting.
   *
   * The effective animated threshold is:
   * `max(minScreenSize, adaptiveMinScreenSize) * _adaptiveLodBoost`
   * when `_isViewportAnimating` is true.
   *
   * Default 4 matches minScreenSize, so the animated floor is redundant
   * at the default settings. It becomes meaningful when minScreenSize is
   * overridden to 0 (full idle fidelity) but adaptive culling during
   * navigation is still desired.
   */
  adaptiveMinScreenSize = 4

  /**
   * Minimum screen-space area (in px²) below which TEXT nodes render
   * as simplified gray rectangles instead of full Paragraphs.
   * Separate from base LOD (minScreenSize) — base LOD skips the node
   * entirely; text LOD keeps the node visible but replaces expensive
   * Paragraph construction with a cheap rect fill.
   *
   * Default 100 (10×10px on screen). Text smaller than this is unreadable
   * and the Paragraph construction is the most expensive per-node operation.
   * Set to 0 to disable text LOD (render all text as Paragraphs regardless of size).
   *
   * Text Paragraph construction is the single most expensive per-node
   * operation in the render pipeline. Skipping it for tiny text nodes
   * at low zoom levels yields significant frame time improvements.
   *
   * Memory impact: ZERO. CPU impact: One float multiply + compare per
   * visible TEXT node.
   */
  minScreenSizeForText = 100

  /**
   * Counter: number of TEXT nodes that were replaced with simplified
   * rectangles due to minScreenSizeForText LOD threshold. Reset to 0
   * at the start of each frame in the direct-render pipeline path.
   */
  _textLodCulledCount = 0

  /**
   * Minimum screen-space area (in px²) below which effects (shadows,
   * blurs) are skipped. Nodes below this threshold still render their
   * fills and strokes, but expensive saveLayer-based effect rendering
   * is skipped entirely.
   *
   * Default 9 (3×3 CSS px on screen). Below this size, even the
   * worst-case effect (inner shadow covering the entire node surface)
   * is indistinguishable from the node's own fill — the shadow occupies
   * every pixel of a < 3×3px element. This provides a conservative bound
   * that prevents wasteful saveLayer/restore + ImageFilter construction
   * on nodes where no human observer could perceive the effect.
   *
   * Drop shadows (truly peripheral effects) are imperceptible well above
   * this threshold, but inner shadows, glass, and layer blur affect the
   * entire surface — the threshold must be sized for the worst case.
   *
   * Set to 0 to disable effect LOD entirely (force full fidelity).
   * Set to 50–100 for zoomed-out views where more visual fidelity loss
   * is acceptable. The adaptive LOD boost during pan/zoom still applies
   * when this is > 0.
   *
   * Memory/CPU impact: Zero. One float multiply + compare per visible node.
   */
  minScreenSizeForEffects = 9

  /**
   * Counter: number of nodes whose effects were skipped due to
   * minScreenSizeForEffects LOD threshold. Reset to 0 at the start
   * of each frame in the direct-render pipeline path.
   */
  _effectLodCulledCount = 0

  /**
   * Whether the viewport is currently being panned or zoomed.
   * When true, LOD thresholds are multiplied by _adaptiveLodBoost
   * to keep frame times under 16ms during navigation.
   */
  _isViewportAnimating = false

  /**
   * Timestamp (performance.now) when the last viewport animation
   * (pan/zoom change) ended. Used with ADAPTIVE_LOD_RESTORE_MS to
   * determine when to restore full detail.
   */
  _animationStopTime = 0

  /**
   * Multiplier applied to all LOD thresholds during active pan/zoom.
   * Default 4 means thresholds are 4× more aggressive during navigation.
   * Set to 1 to disable adaptive boost (same as idle state).
   */
  _adaptiveLodBoost = 4

  /**
   * Milliseconds after the last pan/zoom change before full detail
   * is restored. During this window, LOD thresholds remain boosted
   * to handle rapid successive interactions.
   */
  _adaptiveLodRestoreMs = 200

  /**
   * Tracks whether the cached scene picture was recorded with the
   * animation boost active. Used to invalidate the cache when the
   * animation state changes (since boosted/unboosted renders differ).
   */
  _scenePictureAnimating = false

  /** Previous frame's panX for viewport animation detection */
  _prevPanX: number | null = null

  /** Previous frame's panY for viewport animation detection */
  _prevPanY: number | null = null

  /** Previous frame's zoom for viewport animation detection */
  _prevZoom: number | null = null

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
  declare drawAutoLayoutHover: (
    canvas: Canvas,
    graph: SceneGraph,
    hover?: RenderOverlays['autoLayoutHover']
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
  declare renderText: (
    canvas: Canvas,
    node: SceneNode,
    fill?: Fill,
    isFirstDrawnFill?: boolean
  ) => void
  declare drawNodeFill: (
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    fill?: Fill,
    isFirstDrawnFill?: boolean
  ) => void
  declare applyFill: (fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex?: number) => boolean
  declare applyGradientFill: (fill: GradientFill, node: SceneNode, graph: SceneGraph) => boolean
  declare applyImageFill: (fill: ImageFill, node: SceneNode, graph: SceneGraph) => boolean
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
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const ox = Math.abs(e.offset.x)
        const oy = Math.abs(e.offset.y)
        expand = Math.max(expand, blur + (e.spread ?? 0) + ox, blur + (e.spread ?? 0) + oy)
      } else {
        expand = Math.max(expand, blur)
      }
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
    this.fillPaint.setShader(null)
    this.shaderCache.clear()
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
      this.sectionTitleFont,
      this.labelCache
    )
  }

  hitTestComponentLabel(graph: SceneGraph, canvasX: number, canvasY: number): SceneNode | null {
    return LabelHitTest.hitTestComponentLabel(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.componentLabelFont,
      this.labelCache
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
    this.vectorPathCache.delete(nodeId)
    this.fillGeometryCache.delete(nodeId)
    this.strokeGeometryCache.delete(nodeId)
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
