import { isEqual } from 'es-toolkit'

import type { SceneNode, SceneGraph, Fill, Stroke } from '@open-pencil/scene-graph'
import type { RenderColorSpace, ResolvedRenderColor } from '@open-pencil/scene-graph/color'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

/* eslint-disable max-lines -- SkiaRenderer facade owns CanvasKit state and delegates domain drawing */
import {
  DEFAULT_SELECTION_THEME,
  COMPONENT_COLOR,
  SLOT_COLOR,
  CANVAS_BG_COLOR,
  IS_BROWSER
} from '#core/constants'
import type { EditorState } from '#core/editor/types'
import { RenderProfiler } from '#core/profiler'
import type { FontResolutionSnapshot } from '#core/text/resolver'

import { createImageFilterCache, createMaskFilterCache } from './effects'
import { createRendererImages } from './images/state'
import { LabelCache } from './labels/cache'
import * as LabelHitTest from './labels/hit-test'
import { LabelParagraphCache } from './labels/paragraph-cache'
import { labelHitOptions } from './labels/style'
import { createDashEffectCache } from './overlays/outline'
import { NodePathCaches } from './paths/cache'
import * as RenderColors from './renderer/colors'
import { createChromeFonts, createTextFontState } from './renderer/fonts'
import * as RendererFonts from './renderer/fonts'
import { destroyRenderer, releaseLiveImages } from './renderer/lifecycle'
import {
  initializeRendererPaints,
  initializeRulerPaintColors,
  initializeSelectionPaintColors
} from './renderer/paints'
import * as RenderPipeline from './renderer/pipeline'
import { createCompiledShaders } from './renderer/shaders'
import {
  createFeedbackMarks,
  createWholeScenePicture,
  type NodePictureEntry
} from './renderer/state'
import * as RendererState from './renderer/state'
import * as RenderText from './text'
import { createTextCaches } from './text/caches'
import { TextPreparationCache } from './text/preparation/cache'
export type {
  MeasurementMode,
  PresenceCursor,
  RenderOverlays,
  RulerTheme,
  SelectionTheme
} from './renderer/types'
import type {
  Canvas,
  CanvasKit,
  Font,
  ImageFilter,
  MaskFilter,
  Paint,
  Path,
  Surface,
  TextureSource,
  TypefaceFontProvider
} from 'canvaskit-wasm'

import { createSceneGeometry, type RotationPreview, type SceneGeometry } from '#core/geometry'

import * as Effects from './effects'
import * as Fills from './fills'
import { IssueMarkerStage } from './issues/stage'
import type { PlacedIssueMarker } from './issues/types'
import type { PlacedStatusLabel } from './labels/status'
import type { NodeEditPaints } from './node-edit-overlay'
import { TiledSceneController } from './renderer/tiles'
import type { TransientCanvasPreview } from './renderer/transient-previews'
import type { RenderOverlays, RulerTheme, SelectionTheme } from './renderer/types'
import * as Scene from './scene'
import { type EffectPass, renderEffects as renderShadowEffects } from './shadows'
import * as Shapes from './shapes'
import * as Strokes from './strokes'
import * as TextRender from './text/render'

/**
 * A picture uploaded as a texture that knows its size: an `ImageBitmap`, or a canvas, which
 * WebGL uploads as it does an image though CanvasKit's types leave it out. A canvas is uploaded
 * as it is when this is called, so a WebGPU canvas is passed in the task that drew it.
 */
export type LiveImageSource =
  | Extract<TextureSource, { width: number; height: number }>
  | HTMLCanvasElement

const textureSource = (source: LiveImageSource) => source as TextureSource

export class SkiaRenderer {
  // CanvasKit, its surface, and the paints every draw shares.
  ck: CanvasKit
  surface: Surface
  destroyed = false
  readonly profiler: RenderProfiler
  declare fillPaint: Paint
  declare strokePaint: Paint
  declare selectionPaint: Paint
  declare snapPaint: Paint
  declare auxFill: Paint
  declare auxStroke: Paint
  declare opacityPaint: Paint
  declare effectLayerPaint: Paint
  /** Whether the shared fill and stroke paints carry a shader, so clearing one is a call only when needed. */
  fillPaintShaded = false
  strokePaintShaded = false
  declare rulerBgPaint: Paint
  declare rulerTickPaint: Paint
  declare rulerTextPaint: Paint
  declare rulerHlPaint: Paint
  declare rulerBadgePaint: Paint
  declare rulerLabelPaint: Paint
  declare penPathPaint: Paint
  declare penLiveStrokePaint: Paint
  /** The pencil stroke being drawn; its colour and width are set per frame. */
  declare pencilStrokePaint: Paint
  declare penHandlePaint: Paint
  declare penVertexFill: Paint
  declare penVertexStroke: Paint
  declare nodeEditPaints: NodeEditPaints
  readonly shaders = createCompiledShaders()
  imageFilterCache = createImageFilterCache()
  maskFilterCache = createMaskFilterCache()
  /** Dashes the overlay pass draws with, kept between frames. */
  readonly dashEffects = createDashEffectCache()
  private readonly colors = new Map<string, Float32Array>()
  private readonly tmpColor = new Float32Array(4)
  private readonly tmpRect = new Float32Array(4)

  // The viewport and page being drawn.
  panX = 0
  panY = 0
  zoom = 1
  dpr = 1
  viewportWidth = 0
  viewportHeight = 0
  worldViewport = { x: 0, y: 0, w: 0, h: 0 }
  pageId: string | null = null
  pageColor = CANVAS_BG_COLOR
  showRulers = true
  rulerTheme: RulerTheme | null = null
  /** Selection chrome, set from editor state each frame through {@link setSelectionTheme}. */
  selectionTheme: SelectionTheme = DEFAULT_SELECTION_THEME
  /** Colour space this renderer's surface presents; colours convert into it when painting. */
  presentationColorSpace: RenderColorSpace = 'srgb'
  navigationPhase: EditorState['navigation']['phase'] = 'idle'
  navigationGeneration = 0
  tracksSceneSettlement = true
  /** Scene geometry shared by everything drawn in one frame; `pipeline` starts each frame afresh. */
  frameGeometry: {
    graph: SceneGraph
    preview: RotationPreview | null
    geometry: SceneGeometry
  } | null = null
  /** Layers drawn and skipped in the frame or recording in progress. */
  readonly drawCounts = { nodes: 0, culled: 0 }
  boundEffectLayersToViewport = false

  // Fonts: the document's provider and the faces the chrome draws with.
  fontProvider: TypefaceFontProvider | null = null
  fontsLoaded = false
  fontGeneration = 0
  onFontResolutionSettled:
    | ((snapshot: FontResolutionSnapshot, nodeIds: readonly string[]) => void)
    | undefined
  readonly chromeFonts = createChromeFonts()
  /** Which text waits for fonts, and what each layer's fonts answered for this generation. */
  readonly textFonts = createTextFontState()
  readonly textPreparationCache = new TextPreparationCache()
  readonly textCaches = createTextCaches()
  /** Label widths by font and text, so chrome measures a label once. */
  readonly glyphWidths = new WeakMap<Font, Map<string, number>>()
  readonly labelCache = new LabelCache()
  readonly labelParagraphCache = new LabelParagraphCache(undefined, undefined, {
    onMissingGlyphs: (missing) => RendererFonts.resolveLabelFontCoverage(this, missing)
  })

  // Images and the geometry, pictures, and tiles that hold the drawn scene.
  readonly images = createRendererImages()
  viewportImageRendering = false
  nodePaths = new NodePathCaches()
  /** Each node's picture of itself with its effects, good for the font generation it was recorded at. */
  readonly nodePictures = new Map<string, NodePictureEntry>()
  /** The one picture of the whole page a single-canvas consumer draws from. */
  readonly wholeScene = createWholeScenePicture()
  readonly tiledScene = new TiledSceneController()
  tiledScenePending = false
  /** Tile work beyond the visible tiles remains; the frame loop keeps idle frames coming. */
  tiledSceneBackgroundPending = false
  tiledSceneCovered = false
  readonly transientPreviews = new Map<string, TransientCanvasPreview>()

  // What the overlays show and leave behind for hit testing.
  /** Selections draw handles to drag; off while the canvas offers no edits. */
  editHandles = true
  /**
   * What an empty sticky note shows while it is edited on this canvas, in the interface language;
   * null for a canvas that draws only the document, such as an export.
   */
  stickyPlaceholder: string | null = null
  /** What an empty connector label shows while it is typed into; null draws nothing. */
  connectorLabelPlaceholder: string | null = null
  /** The marked layers staged in world space, placed anew each frame. */
  readonly issueMarkerStage = new IssueMarkerStage()
  /** Issue markers placed in the last overlay pass; hit testing reads the same layout. */
  issueMarkers: PlacedIssueMarker[] = []
  /** Status labels drawn in the last label pass; clicks on them open the status menu. */
  statusLabels: PlacedStatusLabel[] = []
  /** Screen rectangles of UI floating over this canvas, which overlays such as edge pins avoid. */
  overlayObstacles: readonly Rect[] = []
  /** Layers flashing for attention and those the AI is working on or just finished. */
  readonly feedback = createFeedbackMarks()

  color4f(r: number, g: number, b: number, a: number): Float32Array {
    const c = this.tmpColor
    c[0] = r
    c[1] = g
    c[2] = b
    c[3] = a
    return c
  }

  ltrb(l: number, t: number, r: number, b: number): Float32Array {
    const rc = this.tmpRect
    rc[0] = l
    rc[1] = t
    rc[2] = r
    rc[3] = b
    return rc
  }

  /** A colour the chrome draws with every frame, allocated once per theme; callers do not write to it. */
  private cachedColor(key: string, r: number, g: number, b: number, a: number): Float32Array {
    const cached = this.colors.get(key)
    if (cached) return cached
    const color = this.ck.Color4f(r, g, b, a)
    this.colors.set(key, color)
    return color
  }

  selColor(alpha = 1) {
    const { r, g, b } = this.selectionTheme.color
    return this.cachedColor(`sel:${alpha}`, r, g, b, alpha)
  }

  selForegroundColor() {
    const { r, g, b } = this.selectionTheme.foreground
    return this.cachedColor('selfg', r, g, b, 1)
  }

  /** Switches selection chrome to `theme`, repainting the paints that keep it between frames. */
  setSelectionTheme(theme: SelectionTheme = DEFAULT_SELECTION_THEME): void {
    if (isEqual(theme, this.selectionTheme)) return
    this.selectionTheme = { color: { ...theme.color }, foreground: { ...theme.foreground } }
    this.colors.clear()
    initializeSelectionPaintColors(this)
  }

  /** Recolours the ruler paints when the theme changes, rather than on every frame. */
  setRulerTheme(theme: RulerTheme | null): void {
    if (isEqual(theme, this.rulerTheme)) return
    this.rulerTheme = theme
    initializeRulerPaintColors(this)
  }

  /** The geometry of this frame, shared by every overlay that draws from the graph. */
  sceneGeometry(graph: SceneGraph, preview?: RotationPreview | null): SceneGeometry {
    const current = this.frameGeometry
    // A caller that knows no preview takes the frame's geometry as it stands, previewed or not:
    // a flash follows the layer where it is shown, and the frame keeps one geometry.
    if (current?.graph === graph && (preview === undefined || current.preview === preview)) {
      return current.geometry
    }
    const geometry = createSceneGeometry(graph, preview)
    this.frameGeometry = { graph, preview: preview ?? null, geometry }
    return geometry
  }

  compColor(alpha = 1) {
    return this.cachedColor(
      `comp:${alpha}`,
      COMPONENT_COLOR.r,
      COMPONENT_COLOR.g,
      COMPONENT_COLOR.b,
      alpha
    )
  }

  slotColor(alpha = 1) {
    return this.cachedColor(`slot:${alpha}`, SLOT_COLOR.r, SLOT_COLOR.g, SLOT_COLOR.b, alpha)
  }

  /**
   * The outline colour for a node: pink for slots, purple for components, instances and every
   * layer inside them, as in Figma, blue otherwise.
   */
  outlineColor(node: SceneNode, graph: SceneGraph) {
    if (slotPropertyId(node)) return this.slotColor()
    return this.isInComponent(node, graph) ? this.compColor() : this.selColor()
  }

  /** Text drawn on {@link outlineColor}: white on slot and component colors, else the selection foreground. */
  outlineForegroundColor(node: SceneNode, graph: SceneGraph) {
    if (slotPropertyId(node) || this.isInComponent(node, graph)) return this.ck.WHITE
    return this.selForegroundColor()
  }

  /** A component, instance or set, or a layer inside one; content placed in a slot is not. */
  isInComponent(node: SceneNode, graph: SceneGraph): boolean {
    const owner = graph.closest(
      node.id,
      (layer) => this.isComponentType(layer.type) || slotPropertyId(layer) !== undefined
    )
    return owner !== undefined && !slotPropertyId(owner)
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

  async loadFonts(onFallbackFontsLoaded?: () => void): Promise<void> {
    await RendererFonts.loadFonts(this, onFallbackFontsLoaded)
  }

  syncFontGeneration(): void {
    RendererFonts.syncFontGeneration(this)
  }

  trackFontDemand(node: SceneNode, key: string): void {
    RendererFonts.trackFontDemand(this, node, key)
  }

  isTextPictureCurrent(node: SceneNode): boolean {
    return RendererFonts.isTextPictureCurrent(this, node)
  }

  async prepareForExport(graph: SceneGraph, pageId: string, nodeIds: string[]): Promise<void> {
    return RendererFonts.prepareForExport(this, graph, pageId, nodeIds)
  }

  replaceSurface(surface: Surface): void {
    this.tiledScene.destroy()
    // Live textures belong to the old surface's context, so they go before it does.
    releaseLiveImages(this)
    this.surface.delete()
    this.surface = surface
    this.invalidateScenePicture()
  }

  invalidateScenePicture(): void {
    RendererState.invalidateScenePicture(this)
  }

  noteImageFillUser(hash: string, nodeId: string): void {
    const users = this.images.fillUsers.get(hash)
    if (users) users.add(nodeId)
    else this.images.fillUsers.set(hash, new Set([nodeId]))
  }

  /**
   * Redraws the nodes whose images gained a sharper preview since the last frame: their pictures
   * and tiles are invalidated together, so one frame picks up every preview decoded in between.
   */
  flushDecodedPreviews(graph: SceneGraph): void {
    if (this.images.decodedPreviewHashes.size === 0) return
    for (const hash of this.images.decodedPreviewHashes) {
      for (const nodeId of this.images.fillUsers.get(hash) ?? []) {
        this.invalidateNodePicture(nodeId)
        this.tiledScene.invalidateNode(nodeId, graph)
      }
    }
    this.images.decodedPreviewHashes.clear()
  }

  /** Redraws the text that just gained its fonts; tiles keep everything else. */
  invalidateNodesForFonts(graph: SceneGraph, nodeIds: readonly string[]): void {
    const pending = [...nodeIds]
    const seen = new Set<string>()
    while (pending.length > 0) {
      const id = pending.pop()
      if (id === undefined || seen.has(id)) continue
      seen.add(id)
      const node = graph.getNode(id)
      if (!node) continue
      if (node.type === 'TEXT') {
        this.invalidateNodePicture(id)
        this.tiledScene.invalidateNode(id, graph)
        this.invalidateBooleanAncestors(graph, node)
      }
      pending.push(...node.childIds)
    }
  }

  /**
   * A boolean operation keeps its result between draws, and a text operand whose outline waited
   * for its font gave it none: the fonts arriving drop the results of the operations above.
   */
  private invalidateBooleanAncestors(graph: SceneGraph, node: SceneNode): void {
    const seen = new Set<string>()
    let parent = node.parentId ? graph.getNode(node.parentId) : undefined
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      if (parent.type === 'BOOLEAN_OPERATION') {
        this.invalidateVectorPath(parent.id)
        this.invalidateNodePicture(parent.id)
        this.tiledScene.invalidateNode(parent.id, graph)
      }
      parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
    }
  }

  invalidateAllPictures(): void {
    RendererState.invalidateAllPictures(this)
  }

  /**
   * Draws `source` wherever the image `hash` is painted, until it is set to null, and redraws
   * `nodeIds`, the layers that paint it. Frames of the same size reuse one texture. Returns
   * whether a live image is shown, which a browser that cannot upload `source` leaves false.
   */
  setLiveImage(
    hash: string,
    source: LiveImageSource | null,
    nodeIds: Iterable<string> = []
  ): boolean {
    const live = this.images.live.get(hash)
    // A texture made on a surface since replaced has no context left to update or free it in.
    const current = live?.surface === this.surface ? live.image : null
    if (
      source &&
      current &&
      current.width() === source.width &&
      current.height() === source.height
    ) {
      this.surface.updateTextureFromSource(current, textureSource(source))
    } else {
      current?.delete()
      this.images.live.delete(hash)
      const image = source && this.surface.makeImageFromTextureSource(textureSource(source))
      if (image) this.images.live.set(hash, { image, surface: this.surface })
    }
    for (const id of nodeIds) {
      this.invalidateNodePicture(id)
      this.tiledScene.invalidateNode(id)
    }
    return this.images.live.has(hash)
  }

  /**
   * Forgets the decoded image `hash` after its bytes were replaced, such as a shader's frame
   * rendered again, and redraws whatever showed it. Previews notice new bytes themselves.
   */
  forgetImage(hash: string): void {
    const keys = Array.from(this.images.cache.entries(), ([key]) => key)
    for (const key of keys) {
      if (key === hash || key.startsWith(`${hash}:`)) this.images.cache.delete(key)
    }
    this.invalidateAllPictures()
  }

  /** Forgets a layer that left the document: its drawing and the fonts it was waiting for. */
  forgetNode(nodeId: string): void {
    this.textFonts.pending.delete(nodeId)
    this.textFonts.pictureGenerations.delete(nodeId)
    this.invalidateNodePicture(nodeId)
  }

  /** Drops `nodeId`'s cached drawing; `changedKeys`, when known, lets text keep its glyph coverage. */
  invalidateNodePicture(nodeId: string, changedKeys?: readonly (keyof SceneNode)[]): void {
    RendererState.invalidateNodePicture(this, nodeId, changedKeys)
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

  hitTestSectionTitle(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    preview?: RenderOverlays['rotationPreview']
  ): SceneNode | null {
    return LabelHitTest.hitTestSectionTitle(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.chromeFonts.sectionTitle,
      this.labelCache,
      labelHitOptions(this, graph, preview)
    )
  }

  hitTestComponentLabel(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    preview?: RenderOverlays['rotationPreview']
  ): SceneNode | null {
    return LabelHitTest.hitTestComponentLabel(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.chromeFonts.componentLabel,
      this.labelCache,
      labelHitOptions(this, graph, preview)
    )
  }

  hitTestFrameTitle(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    preview?: RenderOverlays['rotationPreview']
  ): SceneNode | null {
    return LabelHitTest.hitTestFrameTitle(
      graph,
      canvasX,
      canvasY,
      this.zoom,
      this.pageId ?? graph.rootId,
      this.chromeFonts.label,
      this.labelCache,
      labelHitOptions(this, graph, preview)
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
    layer: RenderPipeline.RenderLayer = 'full',
    interactive = false
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
      layer,
      interactive
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
    this.nodePaths.invalidate(nodeId)
  }

  measureTextNode(node: SceneNode, maxWidth?: number): { width: number; height: number } | null {
    return RenderText.measureTextNode(this, node, maxWidth)
  }

  nodeFontReadiness(node: SceneNode): RenderText.NodeFontReadiness {
    if (node.type !== 'TEXT') return 'ready'
    const cached = this.textFonts.readiness.get(node.id)
    if (cached?.node === node && cached.generation === this.fontGeneration) {
      return cached.readiness
    }
    const readiness = RenderText.nodeFontReadiness(this, node)
    // A text waiting on a demand another text raised is told nothing when that demand settles,
    // so a pending reading is asked again each frame until the fonts arrive or give up.
    if (readiness !== 'pending') {
      this.textFonts.readiness.set(node.id, { node, generation: this.fontGeneration, readiness })
    }
    return readiness
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
    opts?: RenderText.ParagraphBuildOptions
  ): RenderText.TextLayout {
    return RenderText.buildParagraph(this, node, color, opts)
  }

  resolveFillColorInfo(
    fill: Fill,
    fillIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    return RenderColors.resolveFillColorInfo(
      fill,
      fillIndex,
      node,
      graph,
      this.presentationColorSpace
    )
  }

  resolveFillColor(fill: Fill, fillIndex: number, node: SceneNode, graph: SceneGraph): Color {
    return RenderColors.resolveFillColor(fill, fillIndex, node, graph, this.presentationColorSpace)
  }

  resolveStrokeColorInfo(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    return RenderColors.resolveStrokeColorInfo(
      stroke,
      strokeIndex,
      node,
      graph,
      this.presentationColorSpace
    )
  }

  resolveStrokeColor(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): Color {
    return RenderColors.resolveStrokeColor(
      stroke,
      strokeIndex,
      node,
      graph,
      this.presentationColorSpace
    )
  }

  screenToCanvas(sx: number, sy: number): Vector {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    }
  }

  /**
   * The scene walk's recursion and the geometry and effect caches, reached through the renderer:
   * the modules below need not import one another in a cycle, and a test can stand a double in.
   */
  renderNode(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays,
    parentAbsX?: number,
    parentAbsY?: number,
    frame?: Mat3 | null
  ): void {
    Scene.renderNode(this, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY, frame)
  }

  renderNodeSelf(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays?: RenderOverlays
  ): void {
    Scene.renderNodeSelf(this, canvas, graph, nodeId, overlays)
  }

  renderSection(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    Scene.renderSection(this, canvas, node, graph)
  }

  renderComponentSet(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    Scene.renderComponentSet(this, canvas, node, graph)
  }

  renderShape(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    Scene.renderShape(this, canvas, node, graph)
  }

  renderShapeUncached(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    Scene.renderShapeUncached(this, canvas, node, graph)
  }

  paintShapeContent(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    Scene.paintShapeContent(this, canvas, node, graph)
  }

  renderEffects(canvas: Canvas, node: SceneNode, graph: SceneGraph, pass: EffectPass): void {
    renderShadowEffects(this, canvas, node, graph, pass)
  }

  renderText(canvas: Canvas, node: SceneNode, fill?: Fill): void {
    TextRender.renderText(this, canvas, node, fill)
  }

  applyFill(fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex = 0): boolean {
    return Fills.applyFill(this, fill, node, graph, fillIndex)
  }

  drawNodeFill(canvas: Canvas, node: SceneNode, fill?: Fill): void {
    Fills.drawNodeFill(this, canvas, node, fill)
  }

  drawNodeStroke(canvas: Canvas, node: SceneNode): void {
    Strokes.drawNodeStroke(this, canvas, node)
  }

  drawStrokeWithAlign(
    canvas: Canvas,
    node: SceneNode,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ): void {
    Strokes.drawStrokeWithAlign(this, canvas, node, align)
  }

  clipNodeShape(canvas: Canvas, node: SceneNode): void {
    Shapes.clipNodeShape(this, canvas, node)
  }

  getVectorPaths(node: SceneNode): Path[] | null {
    return Shapes.getVectorPaths(this, node)
  }

  getFillGeometry(node: SceneNode): Path[] | null {
    return Shapes.getFillGeometry(this, node)
  }

  getStrokeGeometry(node: SceneNode): Path[] | null {
    return Shapes.getStrokeGeometry(this, node)
  }

  makeNodeShapePath(node: SceneNode): Path {
    return Shapes.makeNodeShapePath(this, node)
  }

  makePolygonPath(node: SceneNode): Path {
    return Shapes.makePolygonPath(this, node)
  }

  makeRRect(node: SceneNode): Float32Array {
    return Shapes.makeRRect(this, node)
  }

  makeRRectWithSpread(node: SceneNode, spread: number): Float32Array {
    return Shapes.makeRRectWithSpread(this, node, spread)
  }

  getCachedBlur(sigma: number): ImageFilter | null {
    return Effects.getCachedBlur(this, sigma)
  }

  getCachedDecalBlur(sigma: number): ImageFilter | null {
    return Effects.getCachedDecalBlur(this, sigma)
  }

  getCachedDropShadow(
    dx: number,
    dy: number,
    sigma: number,
    color: Float32Array
  ): ImageFilter | null {
    return Effects.getCachedDropShadow(this, dx, dy, sigma, color)
  }

  getCachedMaskBlur(sigma: number): MaskFilter | null {
    return Effects.getCachedMaskBlur(this, sigma)
  }

  applyClippedBlur(canvas: Canvas, node: SceneNode, sigma: number, shape?: Path | null): void {
    Effects.applyClippedBlur(this, canvas, node, sigma, shape)
  }

  destroy(): void {
    destroyRenderer(this)
  }
}
