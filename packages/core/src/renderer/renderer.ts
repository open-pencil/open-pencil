import {
  resolveNodeFillColor,
  resolveNodeStrokeColor,
  type ResolvedRenderColor
} from '../color-management'
/* eslint-disable max-lines -- SkiaRenderer class; text, pen-overlay, fills, scene already extracted */
import {
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  LABEL_OFFSET_Y,
  SIZE_FONT_SIZE,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_GAP,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP,
  RULER_BG_COLOR,
  RULER_TICK_COLOR,
  RULER_TEXT_COLOR,
  DEFAULT_FONT_FAMILY,
  IS_BROWSER
} from '../constants'
import { computeVisualBounds } from '../geometry'
import { RenderProfiler } from '../profiler'
import { drawAiOverlays as drawAiOverlaysFn } from './ai-overlays'
import {
  getCachedDropShadow as getCachedDropShadowFn,
  getCachedBlur as getCachedBlurFn,
  getCachedDecalBlur as getCachedDecalBlurFn,
  getCachedMaskBlur as getCachedMaskBlurFn,
  applyClippedBlur as applyClippedBlurFn
} from './effects'
import {
  drawNodeFill as drawNodeFillFn,
  applyFill as applyFillFn,
  applyGradientFill as applyGradientFillFn,
  applyImageFill as applyImageFillFn,
  drawArc as drawArcFn
} from './fills'
import { LabelCache } from './label-cache'
import {
  drawSectionTitles as drawSectionTitlesFn,
  drawComponentLabels as drawComponentLabelsFn
} from './labels'
import { drawNodeEditOverlay as drawNodeEditOverlayFn } from './node-edit-overlay'
import {
  drawHoverHighlight as drawHoverHighlightFn,
  drawEnteredContainer as drawEnteredContainerFn,
  drawSelection as drawSelectionFn,
  drawNodeSelection as drawNodeSelectionFn,
  drawSelectionLabels as drawSelectionLabelsFn,
  drawParentFrameOutlines as drawParentFrameOutlinesFn,
  drawNodeOutline as drawNodeOutlineFn,
  drawGroupBounds as drawGroupBoundsFn,
  getRotatedCorners as getRotatedCornersFn,
  drawHandle as drawHandleFn,
  drawSnapGuides as drawSnapGuidesFn,
  drawMarquee as drawMarqueeFn,
  drawFlashes as drawFlashesFn,
  drawLayoutInsertIndicator as drawLayoutInsertIndicatorFn,
  drawTextEditOverlay as drawTextEditOverlayFn
} from './overlays'
import {
  drawPenOverlay as drawPenOverlayFn,
  drawRemoteCursors as drawRemoteCursorsFn
} from './pen-overlay'
import { drawRulers as drawRulersFn } from './rulers'
import {
  renderNode as renderNodeFn,
  renderSection as renderSectionFn,
  renderComponentSet as renderComponentSetFn,
  renderShape as renderShapeFn,
  renderShapeUncached as renderShapeUncachedFn,
  renderEffects as renderEffectsFn,
  renderText as renderTextFn
} from './scene'
import {
  makeNodeShapePath as makeNodeShapePathFn,
  makePolygonPath as makePolygonPathFn,
  makeRRect as makeRRectFn,
  makeRRectWithSpread as makeRRectWithSpreadFn,
  makeRRectWithOffset as makeRRectWithOffsetFn,
  clipNodeShape as clipNodeShapeFn,
  getVectorPaths as getVectorPathsFn,
  getFillGeometry as getFillGeometryFn,
  getStrokeGeometry as getStrokeGeometryFn
} from './shapes'
import {
  drawNodeStroke as drawNodeStrokeFn,
  drawStrokeWithAlign as drawStrokeWithAlignFn,
  drawRRectStrokeWithAlign as drawRRectStrokeWithAlignFn,
  drawIndividualSideStrokes as drawIndividualSideStrokesFn,
  strokeNodeShape as strokeNodeShapeFn
} from './strokes'
import {
  measureTextNode as measureTextNodeFn,
  isNodeFontLoaded as isNodeFontLoadedFn,
  buildTextPicture as buildTextPictureFn,
  buildParagraph as buildParagraphFn
} from './text'

import type { EditorState } from '../editor/types'
import type {
  SceneNode,
  SceneGraph,
  Fill,
  Stroke,
  VectorVertex,
  VectorRegion
} from '../scene-graph'
import type { SnapGuide } from '../snap'
import type { TextEditor } from '../text-editor'
import type { Color, Rect, Vector } from '../types'
import type { NodeEditOverlayState } from './node-edit-overlay'
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

export interface RenderOverlays {
  hoveredNodeId?: string | null
  enteredContainerId?: string | null
  editingTextId?: string | null
  textEditor?: TextEditor | null
  marquee?: Rect | null
  snapGuides?: SnapGuide[]
  rotationPreview?: { nodeId: string; angle: number } | null
  dropTargetId?: string | null
  layoutInsertIndicator?: {
    x: number
    y: number
    length: number
    direction: 'HORIZONTAL' | 'VERTICAL'
  } | null
  penState?: {
    vertices: Vector[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    dragTangent: Vector | null
    oppositeDragTangent?: Vector | null
    closingToFirst: boolean
    pendingClose?: boolean
    cursorX?: number
    cursorY?: number
  } | null
  nodeEditState?: {
    nodeId: string
    vertices: VectorVertex[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    regions: VectorRegion[]
    selectedVertexIndices: Set<number>
    /** Set of selected handles as "segIdx:tangentField" strings */
    selectedHandles?: Set<string>
    hoveredHandleInfo?: { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null
  } | null
  remoteCursors?: Array<{
    name: string
    color: Color
    x: number
    y: number
    selection?: string[]
  }>
}

export class SkiaRenderer {
  ck: CanvasKit
  surface: Surface
  fillPaint: Paint
  strokePaint: Paint
  selectionPaint: Paint
  parentOutlinePaint: Paint
  snapPaint: Paint
  auxFill: Paint
  auxStroke: Paint
  opacityPaint: Paint
  effectLayerPaint: Paint
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
  nodePictureCache = new Map<string, SkPicture | null>()
  readonly labelCache = new LabelCache()
  readonly profiler: RenderProfiler

  rulerBgPaint: Paint
  rulerTickPaint: Paint
  rulerTextPaint: Paint
  rulerHlPaint: Paint
  rulerBadgePaint: Paint
  rulerLabelPaint: Paint
  penPathPaint: Paint
  penLiveStrokePaint: Paint
  penHandlePaint: Paint
  penVertexFill: Paint
  penVertexStroke: Paint

  panX = 0
  panY = 0
  zoom = 1
  dpr = 1
  viewportWidth = 0
  viewportHeight = 0
  showRulers = true
  pageColor = CANVAS_BG_COLOR
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

    this.fillPaint = new ck.Paint()
    this.fillPaint.setStyle(ck.PaintStyle.Fill)
    this.fillPaint.setAntiAlias(true)

    this.strokePaint = new ck.Paint()
    this.strokePaint.setStyle(ck.PaintStyle.Stroke)
    this.strokePaint.setAntiAlias(true)

    this.selectionPaint = new ck.Paint()
    this.selectionPaint.setStyle(ck.PaintStyle.Stroke)
    this.selectionPaint.setStrokeWidth(1)
    this.selectionPaint.setColor(this.selColor())
    this.selectionPaint.setAntiAlias(true)

    this.parentOutlinePaint = new ck.Paint()
    this.parentOutlinePaint.setStyle(ck.PaintStyle.Stroke)
    this.parentOutlinePaint.setStrokeWidth(1)
    this.parentOutlinePaint.setColor(this.selColor(PARENT_OUTLINE_ALPHA))
    this.parentOutlinePaint.setAntiAlias(true)
    this.parentOutlinePaint.setPathEffect(
      ck.PathEffect.MakeDash([PARENT_OUTLINE_DASH, PARENT_OUTLINE_DASH], 0)
    )

    this.snapPaint = new ck.Paint()
    this.snapPaint.setStyle(ck.PaintStyle.Stroke)
    this.snapPaint.setStrokeWidth(1)
    this.snapPaint.setColor(this.ck.Color4f(SNAP_COLOR.r, SNAP_COLOR.g, SNAP_COLOR.b, 1))
    this.snapPaint.setAntiAlias(true)

    this.auxFill = new ck.Paint()
    this.auxFill.setStyle(ck.PaintStyle.Fill)
    this.auxFill.setAntiAlias(true)

    this.auxStroke = new ck.Paint()
    this.auxStroke.setStyle(ck.PaintStyle.Stroke)
    this.auxStroke.setAntiAlias(true)

    this.opacityPaint = new ck.Paint()
    this.effectLayerPaint = new ck.Paint()

    this.textFont = new ck.Font(null, DEFAULT_FONT_SIZE)

    const bg = RULER_BG_COLOR
    this.rulerBgPaint = new ck.Paint()
    this.rulerBgPaint.setColor(ck.Color4f(bg.r, bg.g, bg.b, 1))

    this.rulerTickPaint = new ck.Paint()
    this.rulerTickPaint.setColor(
      ck.Color4f(RULER_TICK_COLOR.r, RULER_TICK_COLOR.g, RULER_TICK_COLOR.b, 1)
    )
    this.rulerTickPaint.setStrokeWidth(1)
    this.rulerTickPaint.setAntiAlias(true)

    const tc = RULER_TEXT_COLOR
    this.rulerTextPaint = new ck.Paint()
    this.rulerTextPaint.setColor(ck.Color4f(tc.r, tc.g, tc.b, 1))
    this.rulerTextPaint.setAntiAlias(true)

    this.rulerHlPaint = new ck.Paint()
    this.rulerHlPaint.setAntiAlias(true)

    this.rulerBadgePaint = new ck.Paint()
    this.rulerBadgePaint.setAntiAlias(true)

    this.rulerLabelPaint = new ck.Paint()
    this.rulerLabelPaint.setColor(ck.Color4f(1, 1, 1, 1))
    this.rulerLabelPaint.setAntiAlias(true)

    // Technical outline: 1px grey (same as node-edit techStroke)
    this.penPathPaint = new ck.Paint()
    this.penPathPaint.setStyle(ck.PaintStyle.Stroke)
    this.penPathPaint.setStrokeWidth(1)
    this.penPathPaint.setColor(ck.Color4f(0.698, 0.698, 0.698, 1))
    this.penPathPaint.setAntiAlias(true)

    // Live stroke preview: 2px black (actual object style)
    this.penLiveStrokePaint = new ck.Paint()
    this.penLiveStrokePaint.setStyle(ck.PaintStyle.Stroke)
    this.penLiveStrokePaint.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
    this.penLiveStrokePaint.setColor(ck.Color4f(0, 0, 0, 1))
    this.penLiveStrokePaint.setAntiAlias(true)

    this.penHandlePaint = new ck.Paint()
    this.penHandlePaint.setStyle(ck.PaintStyle.Stroke)
    this.penHandlePaint.setStrokeWidth(1)
    this.penHandlePaint.setColor(this.selColor(PARENT_OUTLINE_ALPHA))
    this.penHandlePaint.setAntiAlias(true)

    this.penVertexFill = new ck.Paint()
    this.penVertexFill.setStyle(ck.PaintStyle.Fill)
    this.penVertexFill.setColor(ck.WHITE)
    this.penVertexFill.setAntiAlias(true)

    // Vertex circle outline: 1px blue
    this.penVertexStroke = new ck.Paint()
    this.penVertexStroke.setStyle(ck.PaintStyle.Stroke)
    this.penVertexStroke.setStrokeWidth(1)
    this.penVertexStroke.setColor(this.selColor())
    this.penVertexStroke.setAntiAlias(true)
  }

  getFontProvider(): TypefaceFontProvider | null {
    return this.fontProvider
  }

  async loadFonts(): Promise<void> {
    this.fontProvider = this.ck.TypefaceFontProvider.Make()

    const { initFontService, loadFont, ensureArabicFallback, ensureCJKFallback } =
      await import('../fonts')
    initFontService(this.ck, this.fontProvider)

    const fontData = await loadFont(DEFAULT_FONT_FAMILY, 'Regular')
    if (fontData) {
      const typeface = this.ck.Typeface.MakeFreeTypeFaceFromData(fontData)
      if (typeface) {
        this.textFont?.delete()
        this.labelFont?.delete()
        this.sizeFont?.delete()
        this.sectionTitleFont?.delete()
        this.componentLabelFont?.delete()
        this.textFont = new this.ck.Font(typeface, DEFAULT_FONT_SIZE)
        this.labelFont = new this.ck.Font(typeface, LABEL_FONT_SIZE)
        this.sizeFont = new this.ck.Font(typeface, SIZE_FONT_SIZE)
        this.sectionTitleFont = new this.ck.Font(typeface, SECTION_TITLE_FONT_SIZE)
        this.componentLabelFont = new this.ck.Font(typeface, COMPONENT_LABEL_FONT_SIZE)
        this.profiler.setTypeface(typeface)
      }
      this.fontMgr = this.ck.FontMgr.FromData(fontData) ?? null
    }

    this.fontsLoaded = true
    this.invalidateAllPictures()

    void ensureCJKFallback().then((families) => {
      if (families.length > 0) this.invalidateAllPictures()
    })
    void ensureArabicFallback().then((families) => {
      if (families.length > 0) this.invalidateAllPictures()
    })
  }

  /**
   * Load document fonts and set up text measurement for layout.
   * Call after `loadFonts()` and before rendering a document headlessly.
   * Collects all font family+weight pairs used by `nodeIds`, loads them,
   * wires up the text measurer for Yoga layout, and recomputes layout.
   */
  async prepareForExport(
    graph: SceneGraph,
    pageId: string,
    nodeIds: string[]
  ): Promise<() => void> {
    const { collectFontKeys, loadFont } = await import('../fonts')
    const { getTextMeasurer, setTextMeasurer, computeAllLayouts } = await import('../layout')

    const previousTextMeasurer = getTextMeasurer()
    setTextMeasurer((node, maxWidth) => this.measureTextNode(node, maxWidth))

    const fontKeys = collectFontKeys(graph, nodeIds)
    await Promise.all(fontKeys.map(([family, style]) => loadFont(family, style)))

    computeAllLayouts(graph, pageId)

    return () => setTextMeasurer(previousTextMeasurer)
  }

  replaceSurface(surface: Surface): void {
    this.surface.delete()
    this.surface = surface
    this.invalidateScenePicture()
  }

  invalidateScenePicture(): void {
    this.scenePicture?.delete()
    this.scenePicture = null
    this.scenePictureVersion = -1
  }

  invalidateAllPictures(): void {
    this.invalidateScenePicture()
    for (const pic of this.nodePictureCache.values()) pic?.delete()
    this.nodePictureCache.clear()
  }

  invalidateNodePicture(nodeId: string): void {
    const pic = this.nodePictureCache.get(nodeId)
    if (pic) {
      pic.delete()
      this.nodePictureCache.delete(nodeId)
    }
  }

  flashNode(nodeId: string): void {
    this._flashes.push({ nodeId, startTime: performance.now() })
  }

  aiMarkActive(nodeIds: string[]): void {
    for (const id of nodeIds) this._aiActiveNodes.add(id)
  }

  aiMarkDone(nodeIds: string[]): void {
    const now = performance.now()
    for (const id of nodeIds) {
      if (this._aiActiveNodes.delete(id)) {
        this._aiDoneFlashes.push({ nodeId: id, startTime: now })
      }
    }
  }

  aiFlashDone(nodeIds: string[]): void {
    const now = performance.now()
    for (const id of nodeIds) {
      this._aiDoneFlashes.push({ nodeId: id, startTime: now })
    }
  }

  aiClearActive(): void {
    this._aiActiveNodes.clear()
  }

  aiClearAll(): void {
    this._aiActiveNodes.clear()
    this._aiDoneFlashes = []
  }

  get hasActiveFlashes(): boolean {
    return (
      this._flashes.length > 0 || this._aiActiveNodes.size > 0 || this._aiDoneFlashes.length > 0
    )
  }

  hitTestSectionTitle(graph: SceneGraph, canvasX: number, canvasY: number): SceneNode | null {
    if (!this.sectionTitleFont) return null

    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
    if (!pageNode) return null

    const font = this.sectionTitleFont
    let result: SceneNode | null = null

    const check = (parentId: string, ox: number, oy: number, insideSection: boolean) => {
      const parent = graph.getNode(parentId)
      if (!parent) return
      for (let i = parent.childIds.length - 1; i >= 0; i--) {
        if (result) return
        const childId = parent.childIds[i]
        const child = graph.getNode(childId)
        if (!child || !child.visible) continue
        const ax = ox + child.x
        const ay = oy + child.y
        if (child.type === 'SECTION') {
          const glyphIds = font.getGlyphIDs(child.name)
          const widths = font.getGlyphWidths(glyphIds)
          let textW = 0
          for (const w of widths) textW += w

          const pillW =
            Math.min(textW + SECTION_TITLE_PADDING_X * 2, child.width * this.zoom) / this.zoom
          const pillH = SECTION_TITLE_HEIGHT / this.zoom
          const gap = SECTION_TITLE_GAP / this.zoom
          const localX = canvasX - ax
          const localY = canvasY - ay

          let hitX = localX
          let hitY = localY
          if (child.rotation !== 0) {
            const rad = (-child.rotation * Math.PI) / 180
            const cos = Math.cos(rad)
            const sin = Math.sin(rad)
            hitX = localX * cos - localY * sin
            hitY = localX * sin + localY * cos
          }

          const pillX = 0
          const pillY = insideSection ? gap : -pillH - gap

          if (hitX >= pillX && hitX <= pillX + pillW && hitY >= pillY && hitY <= pillY + pillH) {
            result = child
            return
          }

          check(childId, ax, ay, true)
        } else if (child.childIds.length > 0) {
          check(childId, ax, ay, insideSection)
        }
      }
    }

    check(pageNode.id, 0, 0, false)
    return result
  }

  hitTestComponentLabel(graph: SceneGraph, canvasX: number, canvasY: number): SceneNode | null {
    if (!this.componentLabelFont) return null

    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
    if (!pageNode) return null

    const font = this.componentLabelFont
    const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET'])
    let result: SceneNode | null = null

    const check = (parentId: string, ox: number, oy: number) => {
      const parent = graph.getNode(parentId)
      if (!parent) return
      for (let i = parent.childIds.length - 1; i >= 0; i--) {
        if (result) return
        const childId = parent.childIds[i]
        const child = graph.getNode(childId)
        if (!child || !child.visible) continue
        const ax = ox + child.x
        const ay = oy + child.y
        if (LABEL_TYPES.has(child.type)) {
          const glyphIds = font.getGlyphIDs(child.name)
          const widths = font.getGlyphWidths(glyphIds)
          let textW = 0
          for (const w of widths) textW += w
          const labelW = (COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP + textW) / this.zoom
          const labelH = COMPONENT_LABEL_FONT_SIZE / this.zoom
          const gap = COMPONENT_LABEL_GAP / this.zoom

          const isInsideSet = parent.type === 'COMPONENT_SET'
          const labelX = ax
          let labelY: number
          if (isInsideSet) {
            labelY = ay + gap
          } else {
            labelY = ay - labelH - gap
          }

          if (
            canvasX >= labelX &&
            canvasX <= labelX + labelW &&
            canvasY >= labelY &&
            canvasY <= labelY + labelH
          ) {
            result = child
            return
          }
        }
        if (child.childIds.length > 0) {
          check(childId, ax, ay)
        }
      }
    }

    check(pageNode.id, 0, 0)
    return result
  }

  hitTestFrameTitle(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    selectedIds: Set<string>
  ): SceneNode | null {
    if (!this.labelFont || selectedIds.size !== 1) return null

    const id = [...selectedIds][0]
    const node = graph.getNode(id)
    if (node?.type !== 'FRAME') return null

    const parent = node.parentId ? graph.getNode(node.parentId) : null
    const isTopLevel = !parent || parent.type === 'CANVAS' || parent.type === 'SECTION'
    if (!isTopLevel) return null

    const abs = graph.getAbsolutePosition(id)
    const font = this.labelFont
    const glyphIds = font.getGlyphIDs(node.name)
    const widths = font.getGlyphWidths(glyphIds)
    let textW = 0
    for (const w of widths) textW += w

    const labelW = textW / this.zoom
    const labelH = LABEL_FONT_SIZE / this.zoom
    const localX = canvasX - abs.x
    const localY = canvasY - abs.y

    let hitX = localX
    let hitY = localY
    if (node.rotation !== 0) {
      const rad = (-node.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      hitX = localX * cos - localY * sin
      hitY = localX * sin + localY * cos
    }

    const labelX = 0
    const labelY = -LABEL_OFFSET_Y / this.zoom - labelH

    if (hitX >= labelX && hitX <= labelX + labelW && hitY >= labelY && hitY <= labelY + labelH) {
      return node
    }

    return null
  }

  renderSceneToCanvas(canvas: Canvas, graph: SceneGraph, pageId: string): void {
    const prevViewport = this.worldViewport
    this.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
    const pageNode = graph.getNode(pageId)
    if (pageNode) {
      for (const childId of pageNode.childIds) {
        this.renderNode(canvas, graph, childId, {})
      }
    }
    this.worldViewport = prevViewport
  }

  renderFromEditorState(
    state: EditorState,
    graph: SceneGraph,
    textEditor: unknown,
    viewportWidth: number,
    viewportHeight: number,
    showRulers = true
  ): void {
    const extendedState = state as EditorState & {
      nodeEditState?: RenderOverlays['nodeEditState']
    }
    this.dpr = IS_BROWSER ? window.devicePixelRatio || 1 : 1
    this.panX = state.panX
    this.panY = state.panY
    this.zoom = state.zoom
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
    this.showRulers = showRulers
    this.pageColor = state.pageColor
    this.pageId = state.currentPageId
    this.render(
      graph,
      state.selectedIds,
      {
        hoveredNodeId: state.hoveredNodeId,
        enteredContainerId: state.enteredContainerId,
        editingTextId: state.editingTextId,
        textEditor: textEditor as RenderOverlays['textEditor'],
        marquee: state.marquee,
        snapGuides: state.snapGuides,
        rotationPreview: state.rotationPreview,
        dropTargetId: state.dropTargetId,
        layoutInsertIndicator: state.layoutInsertIndicator,
        penState: state.penState
          ? ({
              ...state.penState,
              cursorX: state.penCursorX ?? undefined,
              cursorY: state.penCursorY ?? undefined
            } as RenderOverlays['penState'])
          : null,
        nodeEditState: extendedState.nodeEditState ?? null,
        remoteCursors: state.remoteCursors
      },
      state.sceneVersion
    )
  }

  render(
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays = {},
    sceneVersion = -1
  ): void {
    const p = this.profiler
    p.beginFrame()

    graph.clearAbsPosCache()

    const canvas = this.surface.getCanvas()
    canvas.clear(this.ck.Color4f(this.pageColor.r, this.pageColor.g, this.pageColor.b, 1))

    this.worldViewport = {
      x: -this.panX / this.zoom,
      y: -this.panY / this.zoom,
      w: this.viewportWidth / this.zoom,
      h: this.viewportHeight / this.zoom
    }

    const hasVolatileOverlays =
      overlays.dropTargetId != null ||
      overlays.rotationPreview != null ||
      overlays.editingTextId != null ||
      overlays.nodeEditState != null

    const canUsePicture =
      !hasVolatileOverlays &&
      this.scenePicture &&
      sceneVersion === this.scenePictureVersion &&
      this.pageId === this.scenePicturePageId

    p.setCacheHit(!!canUsePicture)

    canvas.save()
    canvas.scale(this.dpr, this.dpr)
    canvas.translate(this.panX, this.panY)
    canvas.scale(this.zoom, this.zoom)

    p.beginPhase('render:scene')
    if (canUsePicture) {
      p.beginPhase('render:drawPicture')
      if (this.scenePicture) canvas.drawPicture(this.scenePicture)
      p.endPhase('render:drawPicture')
    } else if (hasVolatileOverlays) {
      this._nodeCount = 0
      this._culledCount = 0
      p.beginPhase('render:volatile')
      const pageNode = graph.getNode(this.pageId ?? graph.rootId)
      if (pageNode) {
        for (const childId of pageNode.childIds) {
          this.renderNode(canvas, graph, childId, overlays, 0, 0)
        }
      }
      p.endPhase('render:volatile')
    } else {
      this._nodeCount = 0
      this._culledCount = 0
      p.beginPhase('render:recordPicture')
      this.recordScenePicture(canvas, graph, sceneVersion)
      p.endPhase('render:recordPicture')
    }
    p.endPhase('render:scene')

    canvas.restore()

    canvas.save()
    canvas.scale(this.dpr, this.dpr)
    this.labelCache.update(graph, this.pageId, sceneVersion)
    p.beginPhase('render:sectionTitles')
    this.drawSectionTitles(canvas, graph)
    p.endPhase('render:sectionTitles')
    p.beginPhase('render:componentLabels')
    this.drawComponentLabels(canvas, graph)
    p.endPhase('render:componentLabels')
    canvas.restore()

    canvas.save()
    canvas.scale(this.dpr, this.dpr)

    this.drawHoverHighlight(
      canvas,
      graph,
      overlays.hoveredNodeId === overlays.nodeEditState?.nodeId ? null : overlays.hoveredNodeId
    )
    this.drawEnteredContainer(canvas, graph, overlays.enteredContainerId)
    p.beginPhase('render:selection')
    this.drawSelection(canvas, graph, selectedIds, overlays)
    p.endPhase('render:selection')
    this.drawFlashes(canvas, graph)
    this.drawSnapGuides(canvas, overlays.snapGuides)
    this.drawMarquee(canvas, overlays.marquee)
    this.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
    this.drawNodeEditOverlay(canvas, graph, overlays.nodeEditState)
    this.drawPenOverlay(canvas, overlays.penState)
    this.drawRemoteCursors(canvas, graph, overlays.remoteCursors)
    p.beginPhase('render:rulers')
    if (this.showRulers) this.drawRulers(canvas, graph, selectedIds)
    p.endPhase('render:rulers')

    p.drawHUD(canvas, this.showRulers)

    canvas.restore()

    p.beginPhase('render:flush')
    this.surface.flush()
    p.endPhase('render:flush')

    p.setNodeCounts(this._nodeCount, this._culledCount)
    p.endFrame()
  }

  private recordScenePicture(canvas: Canvas, graph: SceneGraph, sceneVersion: number): void {
    this.scenePicture?.delete()
    const prevViewport = this.worldViewport
    this.worldViewport = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }
    const recorder = new this.ck.PictureRecorder()
    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
    const sceneNodes = pageNode
      ? pageNode.childIds
          .map((childId) => graph.getNode(childId))
          .filter((node): node is SceneNode => node != null)
      : []
    const sceneBounds =
      sceneNodes.length > 0
        ? computeVisualBounds(sceneNodes, (id) => graph.getAbsolutePosition(id))
        : { x: 0, y: 0, width: 1, height: 1 }
    const padding = 1024
    const bounds = this.ck.LTRBRect(
      sceneBounds.x - padding,
      sceneBounds.y - padding,
      sceneBounds.x + sceneBounds.width + padding,
      sceneBounds.y + sceneBounds.height + padding
    )
    const recCanvas = recorder.beginRecording(bounds)
    if (pageNode) {
      for (const childId of pageNode.childIds) {
        this.renderNode(recCanvas, graph, childId, {}, 0, 0)
      }
    }
    this.scenePicture = recorder.finishRecordingAsPicture()
    recorder.delete()
    this.worldViewport = prevViewport
    this.scenePictureVersion = sceneVersion
    this.scenePicturePageId = this.pageId
    canvas.drawPicture(this.scenePicture)
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
    return measureTextNodeFn(this, node, maxWidth)
  }

  isNodeFontLoaded(node: SceneNode): boolean {
    return isNodeFontLoadedFn(this, node)
  }

  buildTextPicture(node: SceneNode): Uint8Array | null {
    return buildTextPictureFn(this, node)
  }

  buildParagraph(
    node: SceneNode,
    color?: Float32Array,
    opts?: { halfLeading?: boolean }
  ): Paragraph {
    return buildParagraphFn(this, node, color, opts)
  }

  resolveFillColorInfo(
    fill: Fill,
    fillIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    const varId = node.boundVariables[`fills/${fillIndex}/color`]
    if (varId) {
      const resolved = graph.resolveColorVariable(varId)
      if (resolved) {
        return {
          color: resolved,
          cssColor: '',
          sourceSpace: 'srgb',
          targetSpace: graph.documentColorSpace,
          clipped: false
        }
      }
    }
    return resolveNodeFillColor(fill, fillIndex, node, {
      documentColorSpace: graph.documentColorSpace
    })
  }

  resolveFillColor(fill: Fill, fillIndex: number, node: SceneNode, graph: SceneGraph): Color {
    return this.resolveFillColorInfo(fill, fillIndex, node, graph).color
  }

  resolveStrokeColorInfo(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): ResolvedRenderColor {
    const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
    if (varId) {
      const resolved = graph.resolveColorVariable(varId)
      if (resolved) {
        return {
          color: resolved,
          cssColor: '',
          sourceSpace: 'srgb',
          targetSpace: graph.documentColorSpace,
          clipped: false
        }
      }
    }
    return resolveNodeStrokeColor(stroke, strokeIndex, node, {
      documentColorSpace: graph.documentColorSpace
    })
  }

  resolveStrokeColor(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): Color {
    return this.resolveStrokeColorInfo(stroke, strokeIndex, node, graph).color
  }

  screenToCanvas(sx: number, sy: number): Vector {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    }
  }

  destroyed = false

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    for (const img of this.imageCache.values()) img.delete()
    this.imageCache.clear()
    for (const cache of [this.vectorPathCache, this.fillGeometryCache, this.strokeGeometryCache]) {
      for (const paths of cache.values()) {
        for (const p of paths) p.delete()
      }
      cache.clear()
    }
    this.fillPaint.delete()
    this.strokePaint.delete()
    this.selectionPaint.delete()
    this.snapPaint.delete()
    this.auxFill.delete()
    this.auxStroke.delete()
    this.opacityPaint.delete()
    this.textFont?.delete()
    this.labelFont?.delete()
    this.sizeFont?.delete()
    this.fontMgr?.delete()
    this.fontProvider?.delete()
    this.rulerBgPaint.delete()
    this.rulerTickPaint.delete()
    this.rulerTextPaint.delete()
    this.rulerHlPaint.delete()
    this.rulerBadgePaint.delete()
    this.rulerLabelPaint.delete()
    this.penPathPaint.delete()
    this.penLiveStrokePaint.delete()
    this.penHandlePaint.delete()
    this.penVertexFill.delete()
    this.penVertexStroke.delete()
    this.effectLayerPaint.delete()
    for (const filter of this.imageFilterCache.values()) filter?.delete()
    this.imageFilterCache.clear()
    for (const filter of this.maskFilterCache.values()) filter?.delete()
    this.maskFilterCache.clear()
    for (const pic of this.nodePictureCache.values()) pic?.delete()
    this.nodePictureCache.clear()
    this.scenePicture?.delete()
    this._flashPaint?.delete()
    this.profiler.destroy()
    this.surface.delete()
  }

  // --- Delegation methods ---

  private drawHoverHighlight(
    canvas: Canvas,
    graph: SceneGraph,
    hoveredNodeId?: string | null
  ): void {
    drawHoverHighlightFn(this, canvas, graph, hoveredNodeId)
  }

  private drawEnteredContainer(
    canvas: Canvas,
    graph: SceneGraph,
    enteredContainerId?: string | null
  ): void {
    drawEnteredContainerFn(this, canvas, graph, enteredContainerId)
  }

  private drawSelection(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays
  ): void {
    drawSelectionFn(this, canvas, graph, selectedIds, overlays)
  }

  drawNodeSelection(canvas: Canvas, node: SceneNode, rotation: number, graph: SceneGraph): void {
    drawNodeSelectionFn(this, canvas, node, rotation, graph)
  }

  drawSelectionLabels(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays?: RenderOverlays
  ): void {
    drawSelectionLabelsFn(this, canvas, graph, selectedIds, overlays)
  }

  drawParentFrameOutlines(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
    drawParentFrameOutlinesFn(this, canvas, graph, selectedIds)
  }

  drawNodeOutline(canvas: Canvas, node: SceneNode, rotation: number, graph: SceneGraph): void {
    drawNodeOutlineFn(this, canvas, node, rotation, graph)
  }

  drawGroupBounds(canvas: Canvas, nodes: SceneNode[], graph: SceneGraph): void {
    drawGroupBoundsFn(this, canvas, nodes, graph)
  }

  getRotatedCorners(n: SceneNode, abs: Vector): Vector[] {
    return getRotatedCornersFn(this, n, abs)
  }

  drawHandle(canvas: Canvas, x: number, y: number): void {
    drawHandleFn(this, canvas, x, y)
  }

  private drawSnapGuides(canvas: Canvas, guides?: SnapGuide[]): void {
    drawSnapGuidesFn(this, canvas, guides)
  }

  private drawMarquee(canvas: Canvas, marquee?: Rect | null): void {
    drawMarqueeFn(this, canvas, marquee)
  }

  private drawFlashes(canvas: Canvas, graph: SceneGraph): void {
    drawFlashesFn(this, canvas, graph)
    drawAiOverlaysFn(this, canvas, graph)
  }

  private drawLayoutInsertIndicator(
    canvas: Canvas,
    indicator?: RenderOverlays['layoutInsertIndicator']
  ): void {
    drawLayoutInsertIndicatorFn(this, canvas, indicator)
  }

  drawTextEditOverlay(canvas: Canvas, node: SceneNode, editor: TextEditor): void {
    drawTextEditOverlayFn(this, canvas, node, editor)
  }

  private drawNodeEditOverlay(
    canvas: Canvas,
    graph: SceneGraph,
    editState: RenderOverlays['nodeEditState']
  ): void {
    drawNodeEditOverlayFn(this, canvas, graph, editState as NodeEditOverlayState | null)
  }

  private drawPenOverlay(canvas: Canvas, penState: RenderOverlays['penState']): void {
    drawPenOverlayFn(this, canvas, penState)
  }

  private drawRemoteCursors(
    canvas: Canvas,
    graph: SceneGraph,
    cursors?: RenderOverlays['remoteCursors']
  ): void {
    drawRemoteCursorsFn(this, canvas, graph, cursors)
  }

  private drawRulers(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
    drawRulersFn(this, canvas, graph, selectedIds)
  }

  private drawSectionTitles(canvas: Canvas, graph: SceneGraph): void {
    drawSectionTitlesFn(this, canvas, graph)
  }

  private drawComponentLabels(canvas: Canvas, graph: SceneGraph): void {
    drawComponentLabelsFn(this, canvas, graph)
  }

  renderNode(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays,
    parentAbsX = 0,
    parentAbsY = 0
  ): void {
    renderNodeFn(this, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY)
  }

  renderSection(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    renderSectionFn(this, canvas, node, graph)
  }

  renderComponentSet(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    renderComponentSetFn(this, canvas, node, graph)
  }

  renderShape(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    renderShapeFn(this, canvas, node, graph)
  }

  renderShapeUncached(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    renderShapeUncachedFn(this, canvas, node, graph)
  }

  renderEffects(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    pass: 'behind' | 'front',
    shadowShapeChild?: SceneNode | null
  ): void {
    renderEffectsFn(this, canvas, node, rect, hasRadius, pass, shadowShapeChild)
  }

  renderText(canvas: Canvas, node: SceneNode): void {
    renderTextFn(this, canvas, node)
  }

  drawNodeFill(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
    drawNodeFillFn(this, canvas, node, rect, hasRadius)
  }

  applyFill(fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex = 0): boolean {
    return applyFillFn(this, fill, node, graph, fillIndex)
  }

  applyGradientFill(fill: Fill, node: SceneNode, graph: SceneGraph): void {
    applyGradientFillFn(this, fill, node, graph)
  }

  applyImageFill(fill: Fill, node: SceneNode, graph: SceneGraph): boolean {
    return applyImageFillFn(this, fill, node, graph)
  }

  drawArc(canvas: Canvas, node: SceneNode, paint: Paint): void {
    drawArcFn(this, canvas, node, paint)
  }

  drawNodeStroke(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
    drawNodeStrokeFn(this, canvas, node, rect, hasRadius)
  }

  drawStrokeWithAlign(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ): void {
    drawStrokeWithAlignFn(this, canvas, node, rect, hasRadius, align)
  }

  drawRRectStrokeWithAlign(
    canvas: Canvas,
    rrect: Float32Array,
    node: SceneNode,
    stroke: Stroke
  ): void {
    drawRRectStrokeWithAlignFn(this, canvas, rrect, node, stroke)
  }

  drawIndividualSideStrokes(
    canvas: Canvas,
    node: SceneNode,
    align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  ): void {
    drawIndividualSideStrokesFn(this, canvas, node, align)
  }

  strokeNodeShape(canvas: Canvas, node: SceneNode, paint: Paint): void {
    strokeNodeShapeFn(this, canvas, node, paint)
  }

  makeNodeShapePath(node: SceneNode, rect: Float32Array, hasRadius: boolean): Path {
    return makeNodeShapePathFn(this, node, rect, hasRadius)
  }

  makePolygonPath(node: SceneNode): Path {
    return makePolygonPathFn(this, node)
  }

  makeRRect(node: SceneNode): Float32Array {
    return makeRRectFn(this, node)
  }

  makeRRectWithSpread(node: SceneNode, spread: number): Float32Array {
    return makeRRectWithSpreadFn(this, node, spread)
  }

  makeRRectWithOffset(node: SceneNode, ox: number, oy: number, spread: number): Float32Array {
    return makeRRectWithOffsetFn(this, node, ox, oy, spread)
  }

  clipNodeShape(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
    clipNodeShapeFn(this, canvas, node, rect, hasRadius)
  }

  getVectorPaths(node: SceneNode): Path[] | null {
    return getVectorPathsFn(this, node)
  }

  getFillGeometry(node: SceneNode): Path[] | null {
    return getFillGeometryFn(this, node)
  }

  getStrokeGeometry(node: SceneNode): Path[] | null {
    return getStrokeGeometryFn(this, node)
  }

  getCachedDropShadow(dx: number, dy: number, sigma: number, color: Float32Array): ImageFilter {
    return getCachedDropShadowFn(this, dx, dy, sigma, color)
  }

  getCachedBlur(sigma: number): ImageFilter {
    return getCachedBlurFn(this, sigma)
  }

  getCachedDecalBlur(sigma: number): ImageFilter {
    return getCachedDecalBlurFn(this, sigma)
  }

  getCachedMaskBlur(sigma: number): MaskFilter {
    return getCachedMaskBlurFn(this, sigma)
  }

  applyClippedBlur(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    sigma: number
  ): void {
    applyClippedBlurFn(this, canvas, node, rect, hasRadius, sigma)
  }
}
