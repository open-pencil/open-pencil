import {
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  ROTATION_HANDLE_OFFSET,
  RULER_SIZE,
  RULER_BG_COLOR,
  RULER_TICK_COLOR,
  RULER_TEXT_COLOR,
  RULER_BADGE_HEIGHT,
  RULER_BADGE_PADDING,
  RULER_BADGE_RADIUS,
  RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE,
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_HIGHLIGHT_ALPHA,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SIZE_FONT_SIZE,
  ROTATION_HANDLE_RADIUS,
  HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA,
  SELECTION_DASH_ALPHA,
  DROP_HIGHLIGHT_ALPHA,
  DROP_HIGHLIGHT_STROKE,
  LAYOUT_INDICATOR_STROKE,
  SECTION_CORNER_RADIUS,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_GAP,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP,
  RULER_TARGET_PIXEL_SPACING,
  RULER_MAJOR_TOLERANCE,
  TEXT_SELECTION_COLOR,
  TEXT_CARET_COLOR,
  TEXT_CARET_WIDTH
} from './constants'
import { vectorNetworkToPath } from './vector'
import { isFontLoaded } from './fonts'

import type { SceneNode, SceneGraph, Fill, Stroke } from './scene-graph'
import type { SnapGuide } from './snap'
import type { TextEditor } from './text-editor'
import type { Color } from './types'
import type { Rect } from './types'
import type { EmbindEnumEntity, Image as CKImage, Path } from 'canvaskit-wasm'
import type {
  CanvasKit,
  Surface,
  Canvas,
  Paint,
  Font,
  FontMgr,
  FontWeight,
  TypefaceFontProvider,
  SkPicture,
  ImageFilter,
  MaskFilter
} from 'canvaskit-wasm'

export interface RenderOverlays {
  hoveredNodeId?: string | null
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
    vertices: Array<{ x: number; y: number }>
    segments: Array<{
      start: number
      end: number
      tangentStart: { x: number; y: number }
      tangentEnd: { x: number; y: number }
    }>
    dragTangent: { x: number; y: number } | null
    closingToFirst: boolean
    cursorX?: number
    cursorY?: number
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
  private ck: CanvasKit
  private surface: Surface
  private fillPaint: Paint
  private strokePaint: Paint
  private selectionPaint: Paint
  private parentOutlinePaint: Paint
  private snapPaint: Paint
  private auxFill: Paint
  private auxStroke: Paint
  private opacityPaint: Paint
  private effectLayerPaint: Paint
  private imageFilterCache = new Map<string, ImageFilter>()
  private maskFilterCache = new Map<number, MaskFilter>()
  private _tmpColor = new Float32Array(4)
  private _tmpRect = new Float32Array(4)
  private textFont: Font | null = null
  private labelFont: Font | null = null
  private sizeFont: Font | null = null
  private sectionTitleFont: Font | null = null
  private componentLabelFont: Font | null = null
  private fontMgr: FontMgr | null = null
  private fontProvider: TypefaceFontProvider | null = null
  private fontsLoaded = false
  private imageCache = new Map<string, CKImage>()
  private vectorPathCache = new Map<string, Path>()
  private scenePicture: SkPicture | null = null
  private scenePictureVersion = -1
  private scenePicturePageId: string | null = null
  private nodePictureCache = new Map<string, SkPicture>()

  private rulerBgPaint: Paint
  private rulerTickPaint: Paint
  private rulerTextPaint: Paint
  private rulerHlPaint: Paint
  private rulerBadgePaint: Paint
  private rulerLabelPaint: Paint
  private penPathPaint: Paint
  private penHandlePaint: Paint
  private penVertexFill: Paint
  private penVertexStroke: Paint

  panX = 0
  panY = 0
  zoom = 1
  dpr = 1
  viewportWidth = 0
  viewportHeight = 0
  showRulers = true
  pageColor = CANVAS_BG_COLOR
  pageId: string | null = null

  private worldViewport = { x: 0, y: 0, w: 0, h: 0 }

  private color4f(r: number, g: number, b: number, a: number): Float32Array {
    const c = this._tmpColor
    c[0] = r
    c[1] = g
    c[2] = b
    c[3] = a
    return c
  }

  private ltrb(l: number, t: number, r: number, b: number): Float32Array {
    const rc = this._tmpRect
    rc[0] = l
    rc[1] = t
    rc[2] = r
    rc[3] = b
    return rc
  }

  private selColor(alpha = 1) {
    return this.ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, alpha)
  }

  private compColor(alpha = 1) {
    return this.ck.Color4f(COMPONENT_COLOR.r, COMPONENT_COLOR.g, COMPONENT_COLOR.b, alpha)
  }

  private isComponentType(type: string): boolean {
    return type === 'COMPONENT' || type === 'COMPONENT_SET' || type === 'INSTANCE'
  }

  constructor(ck: CanvasKit, surface: Surface) {
    this.ck = ck
    this.surface = surface

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

    this.penPathPaint = new ck.Paint()
    this.penPathPaint.setStyle(ck.PaintStyle.Stroke)
    this.penPathPaint.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
    this.penPathPaint.setColor(this.selColor())
    this.penPathPaint.setAntiAlias(true)

    this.penHandlePaint = new ck.Paint()
    this.penHandlePaint.setStyle(ck.PaintStyle.Stroke)
    this.penHandlePaint.setStrokeWidth(1)
    this.penHandlePaint.setColor(this.selColor(PARENT_OUTLINE_ALPHA))
    this.penHandlePaint.setAntiAlias(true)

    this.penVertexFill = new ck.Paint()
    this.penVertexFill.setStyle(ck.PaintStyle.Fill)
    this.penVertexFill.setColor(ck.WHITE)
    this.penVertexFill.setAntiAlias(true)

    this.penVertexStroke = new ck.Paint()
    this.penVertexStroke.setStyle(ck.PaintStyle.Stroke)
    this.penVertexStroke.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
    this.penVertexStroke.setColor(this.selColor())
    this.penVertexStroke.setAntiAlias(true)
  }

  getFontProvider(): TypefaceFontProvider | null {
    return this.fontProvider
  }

  async loadFonts(): Promise<void> {
    this.fontProvider = this.ck.TypefaceFontProvider.Make()

    const { initFontService, loadFont } = await import('./fonts')
    initFontService(this.ck, this.fontProvider)

    const fontData = await loadFont('Inter', 'Regular')
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
      }
      this.fontMgr = this.ck.FontMgr.FromData(fontData) ?? null
    }

    this.fontsLoaded = true
    this.invalidateAllPictures()
  }

  invalidateScenePicture(): void {
    this.scenePicture?.delete()
    this.scenePicture = null
    this.scenePictureVersion = -1
  }

  invalidateAllPictures(): void {
    this.invalidateScenePicture()
    for (const pic of this.nodePictureCache.values()) pic.delete()
    this.nodePictureCache.clear()
  }

  invalidateNodePicture(nodeId: string): void {
    const pic = this.nodePictureCache.get(nodeId)
    if (pic) {
      pic.delete()
      this.nodePictureCache.delete(nodeId)
    }
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
          // Compute pill width from font metrics
          const glyphIds = font.getGlyphIDs(child.name)
          const widths = font.getGlyphWidths(glyphIds)
          let textW = 0
          for (const w of widths) textW += w
          const pillW =
            Math.min(textW + SECTION_TITLE_PADDING_X * 2, child.width * this.zoom) / this.zoom
          const pillH = SECTION_TITLE_HEIGHT / this.zoom
          const gap = SECTION_TITLE_GAP / this.zoom

          let pillX = ax
          let pillY: number
          if (insideSection) {
            pillY = ay + gap
          } else {
            pillY = ay - pillH - gap
          }

          if (
            canvasX >= pillX &&
            canvasX <= pillX + pillW &&
            canvasY >= pillY &&
            canvasY <= pillY + pillH
          ) {
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
    const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE'])
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

  renderSceneToCanvas(canvas: Canvas, graph: SceneGraph, pageId: string): void {
    // Disable culling for export — render everything
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

  render(
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays = {},
    sceneVersion = -1
  ): void {
    const canvas = this.surface.getCanvas()
    canvas.clear(this.ck.Color4f(this.pageColor.r, this.pageColor.g, this.pageColor.b, 1))

    // Compute world-space viewport for culling
    this.worldViewport = {
      x: -this.panX / this.zoom,
      y: -this.panY / this.zoom,
      w: this.viewportWidth / this.zoom,
      h: this.viewportHeight / this.zoom
    }

    const hasVolatileOverlays =
      overlays.hoveredNodeId != null ||
      overlays.dropTargetId != null ||
      overlays.rotationPreview != null ||
      overlays.editingTextId != null

    const canUsePicture =
      !hasVolatileOverlays &&
      this.scenePicture &&
      sceneVersion === this.scenePictureVersion &&
      this.pageId === this.scenePicturePageId

    // Scene layer (world coordinates)
    canvas.save()
    canvas.scale(this.dpr, this.dpr)
    canvas.translate(this.panX, this.panY)
    canvas.scale(this.zoom, this.zoom)

    if (canUsePicture) {
      canvas.drawPicture(this.scenePicture!)
    } else if (hasVolatileOverlays) {
      const pageNode = graph.getNode(this.pageId ?? graph.rootId)
      if (pageNode) {
        for (const childId of pageNode.childIds) {
          this.renderNode(canvas, graph, childId, overlays, 0, 0)
        }
      }
    } else {
      this.recordScenePicture(canvas, graph, sceneVersion)
    }

    canvas.restore()

    // Section titles + component labels (screen coordinates, zoom-independent)
    canvas.save()
    canvas.scale(this.dpr, this.dpr)
    this.drawSectionTitles(canvas, graph)
    this.drawComponentLabels(canvas, graph)
    canvas.restore()

    // UI overlay layer (screen coordinates, zoom-independent)
    canvas.save()
    canvas.scale(this.dpr, this.dpr)

    this.drawSelection(canvas, graph, selectedIds, overlays)
    this.drawSnapGuides(canvas, overlays.snapGuides)
    this.drawMarquee(canvas, overlays.marquee)
    this.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
    this.drawPenOverlay(canvas, overlays.penState)
    this.drawRemoteCursors(canvas, graph, overlays.remoteCursors)
    if (this.showRulers) this.drawRulers(canvas, graph, selectedIds)

    canvas.restore()
    this.surface.flush()
  }

  private recordScenePicture(canvas: Canvas, graph: SceneGraph, sceneVersion: number): void {
    this.scenePicture?.delete()
    const prevViewport = this.worldViewport
    this.worldViewport = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }
    const recorder = new this.ck.PictureRecorder()
    const bounds = this.ck.LTRBRect(-1e6, -1e6, 1e6, 1e6)
    const recCanvas = recorder.beginRecording(bounds)
    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
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
    canvas.drawPicture(this.scenePicture!)
  }

  // --- Selection UI ---

  private drawSelection(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays
  ): void {
    if (selectedIds.size === 0) return

    this.drawParentFrameOutlines(canvas, graph, selectedIds)

    if (selectedIds.size === 1) {
      const id = [...selectedIds][0]
      if (overlays.editingTextId === id) return
      const node = graph.getNode(id)
      if (!node) return

      const useComponentColor = this.isComponentType(node.type)
      this.selectionPaint.setColor(useComponentColor ? this.compColor() : this.selColor())
      this.selectionPaint.setStrokeWidth(1)

      const rotation =
        overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
      this.drawNodeSelection(canvas, node, rotation, graph)
      this.drawSelectionLabels(canvas, graph, selectedIds)

      this.selectionPaint.setColor(this.selColor())
      return
    }

    for (const id of selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue

      const useComponentColor = this.isComponentType(node.type)
      this.selectionPaint.setColor(useComponentColor ? this.compColor() : this.selColor())
      this.selectionPaint.setStrokeWidth(1)

      const rotation =
        overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
      this.drawNodeOutline(canvas, node, rotation, graph)
    }

    this.selectionPaint.setColor(this.selColor())

    const nodes = [...selectedIds]
      .map((id) => graph.getNode(id))
      .filter((n): n is SceneNode => n !== undefined)
    this.drawGroupBounds(canvas, nodes, graph)

    this.drawSelectionLabels(canvas, graph, selectedIds)
  }

  private drawNodeSelection(
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph
  ): void {
    const abs = graph.getAbsolutePosition(node.id)
    const cx = (abs.x + node.width / 2) * this.zoom + this.panX
    const cy = (abs.y + node.height / 2) * this.zoom + this.panY
    const hw = (node.width / 2) * this.zoom
    const hh = (node.height / 2) * this.zoom

    canvas.save()
    if (rotation !== 0) {
      canvas.rotate(rotation, cx, cy)
    }

    const x1 = cx - hw
    const y1 = cy - hh
    const x2 = cx + hw
    const y2 = cy + hh

    canvas.drawRect(this.ck.LTRBRect(x1, y1, x2, y2), this.selectionPaint)

    // Corner handles
    this.drawHandle(canvas, x1, y1)
    this.drawHandle(canvas, x2, y1)
    this.drawHandle(canvas, x1, y2)
    this.drawHandle(canvas, x2, y2)

    // Edge handles
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    this.drawHandle(canvas, mx, y1)
    this.drawHandle(canvas, mx, y2)
    this.drawHandle(canvas, x1, my)
    this.drawHandle(canvas, x2, my)

    // Rotation handle (line extending above + circle)
    const rotHandleY = y1 - ROTATION_HANDLE_OFFSET - ROTATION_HANDLE_RADIUS
    this.auxStroke.setStrokeWidth(1)
    this.auxStroke.setColor(this.selColor())
    this.auxStroke.setPathEffect(null)
    canvas.drawLine(mx, y1, mx, rotHandleY, this.auxStroke)

    this.auxFill.setColor(this.ck.WHITE)
    canvas.drawCircle(mx, rotHandleY, ROTATION_HANDLE_RADIUS, this.auxFill)
    canvas.drawCircle(mx, rotHandleY, ROTATION_HANDLE_RADIUS, this.auxStroke)

    canvas.restore()
  }

  private drawSelectionLabels(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
    if (!this.labelFont || !this.sizeFont) return

    // Compute bounding box of all selected nodes
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const nodes: SceneNode[] = []

    for (const id of selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      nodes.push(node)
      const abs = graph.getAbsolutePosition(id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + node.width)
      maxY = Math.max(maxY, abs.y + node.height)
    }

    if (nodes.length === 0) return

    const sx1 = minX * this.zoom + this.panX
    const sy1 = minY * this.zoom + this.panY
    const sx2 = maxX * this.zoom + this.panX
    const sy2 = maxY * this.zoom + this.panY
    const smx = (sx1 + sx2) / 2

    if (nodes.length === 1) {
      const node = nodes[0]
      const parentNode = node.parentId ? graph.getNode(node.parentId) : null
      const isTopLevel =
        !parentNode || parentNode.type === 'CANVAS' || parentNode.type === 'SECTION'
      if (node.type === 'FRAME' && isTopLevel) {
        this.auxFill.setColor(this.selColor())
        canvas.drawText(node.name, sx1, sy1 - LABEL_OFFSET_Y, this.auxFill, this.labelFont)
      }
    }

    // Size widget — blue pill below selection
    const w = Math.round(maxX - minX)
    const h = Math.round(maxY - minY)
    const sizeText = `${w} × ${h}`
    const glyphIds = this.sizeFont.getGlyphIDs(sizeText)
    const widths = this.sizeFont.getGlyphWidths(glyphIds)
    let textWidth = 0
    for (let i = 0; i < widths.length; i++) textWidth += widths[i]
    const pillW = textWidth + SIZE_PILL_PADDING_X * 2
    const pillH = SIZE_PILL_HEIGHT
    const pillX = smx - pillW / 2
    const pillY = sy2 + SIZE_PILL_PADDING_Y

    const allComponents = nodes.length > 0 && nodes.every((n) => this.isComponentType(n.type))
    const pillColor = allComponents ? this.compColor() : this.selColor()

    this.auxFill.setColor(pillColor)
    const rrect = this.ck.RRectXY(
      this.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH),
      SIZE_PILL_RADIUS,
      SIZE_PILL_RADIUS
    )
    canvas.drawRRect(rrect, this.auxFill)

    this.auxFill.setColor(this.ck.WHITE)
    canvas.drawText(
      sizeText,
      pillX + SIZE_PILL_PADDING_X,
      pillY + SIZE_PILL_TEXT_OFFSET_Y,
      this.auxFill,
      this.sizeFont
    )
  }

  private drawParentFrameOutlines(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>
  ): void {
    const drawn = new Set<string>()
    for (const id of selectedIds) {
      const node = graph.getNode(id)
      if (!node?.parentId) continue
      const nodeParent = graph.getNode(node.parentId)
      if (!nodeParent || nodeParent.type === 'CANVAS') continue
      if (drawn.has(node.parentId) || selectedIds.has(node.parentId)) continue

      const parent = nodeParent

      // Skip dashed outline for top-level frames (direct children of page)
      const grandparent = parent.parentId ? graph.getNode(parent.parentId) : null
      if (!grandparent || grandparent.type === 'CANVAS') continue

      drawn.add(node.parentId)

      const abs = graph.getAbsolutePosition(parent.id)
      const x = abs.x * this.zoom + this.panX
      const y = abs.y * this.zoom + this.panY
      const w = parent.width * this.zoom
      const h = parent.height * this.zoom

      canvas.save()
      if (parent.rotation !== 0) {
        canvas.rotate(parent.rotation, x + w / 2, y + h / 2)
      }
      canvas.drawRect(this.ck.LTRBRect(x, y, x + w, y + h), this.parentOutlinePaint)
      canvas.restore()
    }
  }

  private drawNodeOutline(
    canvas: Canvas,
    node: SceneNode,
    rotation: number,
    graph: SceneGraph
  ): void {
    const abs = graph.getAbsolutePosition(node.id)
    const cx = (abs.x + node.width / 2) * this.zoom + this.panX
    const cy = (abs.y + node.height / 2) * this.zoom + this.panY
    const hw = (node.width / 2) * this.zoom
    const hh = (node.height / 2) * this.zoom

    canvas.save()
    if (rotation !== 0) {
      canvas.rotate(rotation, cx, cy)
    }

    canvas.drawRect(this.ck.LTRBRect(cx - hw, cy - hh, cx + hw, cy + hh), this.selectionPaint)
    canvas.restore()
  }

  private drawGroupBounds(canvas: Canvas, nodes: SceneNode[], graph: SceneGraph): void {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const n of nodes) {
      const abs = graph.getAbsolutePosition(n.id)
      if (n.rotation !== 0) {
        const corners = this.getRotatedCorners(n, abs)
        for (const c of corners) {
          minX = Math.min(minX, c.x)
          minY = Math.min(minY, c.y)
          maxX = Math.max(maxX, c.x)
          maxY = Math.max(maxY, c.y)
        }
      } else {
        const x1 = abs.x * this.zoom + this.panX
        const y1 = abs.y * this.zoom + this.panY
        const x2 = (abs.x + n.width) * this.zoom + this.panX
        const y2 = (abs.y + n.height) * this.zoom + this.panY
        minX = Math.min(minX, x1)
        minY = Math.min(minY, y1)
        maxX = Math.max(maxX, x2)
        maxY = Math.max(maxY, y2)
      }
    }

    // Dashed bounding box
    this.auxStroke.setStrokeWidth(1)
    this.auxStroke.setColor(this.selColor(SELECTION_DASH_ALPHA))
    this.auxStroke.setPathEffect(null)

    canvas.drawRect(this.ck.LTRBRect(minX, minY, maxX, maxY), this.auxStroke)

    // Group resize handles
    this.drawHandle(canvas, minX, minY)
    this.drawHandle(canvas, maxX, minY)
    this.drawHandle(canvas, minX, maxY)
    this.drawHandle(canvas, maxX, maxY)
    const gmx = (minX + maxX) / 2
    const gmy = (minY + maxY) / 2
    this.drawHandle(canvas, gmx, minY)
    this.drawHandle(canvas, gmx, maxY)
    this.drawHandle(canvas, minX, gmy)
    this.drawHandle(canvas, maxX, gmy)
  }

  private getRotatedCorners(n: SceneNode, abs: { x: number; y: number }) {
    const cx = (abs.x + n.width / 2) * this.zoom + this.panX
    const cy = (abs.y + n.height / 2) * this.zoom + this.panY
    const hw = (n.width / 2) * this.zoom
    const hh = (n.height / 2) * this.zoom
    const rad = (n.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    return [
      { x: cx + -hw * cos - -hh * sin, y: cy + -hw * sin + -hh * cos },
      { x: cx + hw * cos - -hh * sin, y: cy + hw * sin + -hh * cos },
      { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
      { x: cx + -hw * cos - hh * sin, y: cy + -hw * sin + hh * cos }
    ]
  }

  private drawHandle(canvas: Canvas, x: number, y: number): void {
    this.auxFill.setColor(this.ck.WHITE)
    const rect = this.ck.LTRBRect(
      x - HANDLE_HALF_SIZE,
      y - HANDLE_HALF_SIZE,
      x + HANDLE_HALF_SIZE,
      y + HANDLE_HALF_SIZE
    )
    canvas.drawRect(rect, this.auxFill)
    canvas.drawRect(rect, this.selectionPaint)
  }

  // --- Snap guides ---

  private drawSnapGuides(canvas: Canvas, guides?: SnapGuide[]): void {
    if (!guides || guides.length === 0) return

    for (const guide of guides) {
      if (guide.axis === 'x') {
        const x = guide.position * this.zoom + this.panX
        const y1 = guide.from * this.zoom + this.panY
        const y2 = guide.to * this.zoom + this.panY
        canvas.drawLine(x, y1, x, y2, this.snapPaint)
      } else {
        const y = guide.position * this.zoom + this.panY
        const x1 = guide.from * this.zoom + this.panX
        const x2 = guide.to * this.zoom + this.panX
        canvas.drawLine(x1, y, x2, y, this.snapPaint)
      }
    }
  }

  // --- Marquee ---

  private drawMarquee(canvas: Canvas, marquee?: Rect | null): void {
    if (!marquee || marquee.width <= 0 || marquee.height <= 0) return

    const x1 = marquee.x * this.zoom + this.panX
    const y1 = marquee.y * this.zoom + this.panY
    const x2 = (marquee.x + marquee.width) * this.zoom + this.panX
    const y2 = (marquee.y + marquee.height) * this.zoom + this.panY
    const rect = this.ck.LTRBRect(x1, y1, x2, y2)

    this.auxFill.setColor(this.selColor(MARQUEE_FILL_ALPHA))
    canvas.drawRect(rect, this.auxFill)
    canvas.drawRect(rect, this.selectionPaint)
  }

  // --- Layout insert indicator ---

  private drawLayoutInsertIndicator(
    canvas: Canvas,
    indicator?: RenderOverlays['layoutInsertIndicator']
  ): void {
    if (!indicator) return

    this.auxStroke.setStrokeWidth(LAYOUT_INDICATOR_STROKE)
    this.auxStroke.setColor(this.selColor())
    this.auxStroke.setPathEffect(null)

    if (indicator.direction === 'HORIZONTAL') {
      const y = indicator.y * this.zoom + this.panY
      const x1 = indicator.x * this.zoom + this.panX
      const x2 = (indicator.x + indicator.length) * this.zoom + this.panX
      canvas.drawLine(x1, y, x2, y, this.auxStroke)
    } else {
      const x = indicator.x * this.zoom + this.panX
      const y1 = indicator.y * this.zoom + this.panY
      const y2 = (indicator.y + indicator.length) * this.zoom + this.panY
      canvas.drawLine(x, y1, x, y2, this.auxStroke)
    }
  }

  // --- Scene rendering ---

  private renderNode(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays,
    parentAbsX = 0,
    parentAbsY = 0
  ): void {
    const node = graph.getNode(nodeId)
    if (!node || !node.visible) return

    const absX = parentAbsX + node.x
    const absY = parentAbsY + node.y

    // Viewport culling: skip nodes entirely outside the visible area.
    // Only cull leaf nodes and clipped containers — unclipped containers
    // may have children that extend beyond the parent's bounds.
    const canCull =
      node.childIds.length === 0 ||
      ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
        node.clipsContent)
    if (canCull) {
      const vp = this.worldViewport
      // Expand bounds for rotation (diagonal is the max extent)
      let bw = node.width
      let bh = node.height
      if (node.rotation !== 0) {
        const diag = Math.sqrt(bw * bw + bh * bh)
        const cx = absX + bw / 2
        const cy = absY + bh / 2
        if (
          cx - diag / 2 > vp.x + vp.w ||
          cy - diag / 2 > vp.y + vp.h ||
          cx + diag / 2 < vp.x ||
          cy + diag / 2 < vp.y
        ) {
          return
        }
      } else if (absX > vp.x + vp.w || absY > vp.y + vp.h || absX + bw < vp.x || absY + bh < vp.y) {
        return
      }
    }

    canvas.save()
    canvas.translate(node.x, node.y)

    if (node.opacity < 1) {
      this.opacityPaint.setAlphaf(node.opacity)
      canvas.saveLayer(this.opacityPaint)
    }

    const layerBlur = node.effects.find((e) => e.visible && e.type === 'LAYER_BLUR')
    if (layerBlur) {
      this.effectLayerPaint.setImageFilter(this.getCachedBlur(layerBlur.radius / 2))
      canvas.saveLayer(this.effectLayerPaint)
    }

    const rotation =
      overlays.rotationPreview?.nodeId === nodeId ? overlays.rotationPreview.angle : node.rotation

    if (rotation !== 0) {
      canvas.rotate(rotation, node.width / 2, node.height / 2)
    }

    if (node.type === 'SECTION') {
      this.renderSection(canvas, node, graph)
    } else if (node.type === 'COMPONENT_SET') {
      this.renderComponentSet(canvas, node, graph)
    } else {
      this.renderShape(canvas, node, graph)
    }

    if (overlays.editingTextId === nodeId && overlays.textEditor?.state?.paragraph) {
      this.drawTextEditOverlay(canvas, node, overlays.textEditor)
    }

    // Drop target highlight
    if (overlays.dropTargetId === nodeId) {
      this.auxStroke.setStrokeWidth(DROP_HIGHLIGHT_STROKE / this.zoom)
      this.auxStroke.setColor(this.selColor(DROP_HIGHLIGHT_ALPHA))
      canvas.drawRect(this.ck.LTRBRect(0, 0, node.width, node.height), this.auxStroke)
    }

    // Hover highlight — shape-aware outline
    if (overlays.hoveredNodeId === nodeId) {
      this.auxStroke.setStrokeWidth(1 / this.zoom)
      this.auxStroke.setColor(this.isComponentType(node.type) ? this.compColor() : this.selColor())
      this.auxStroke.setPathEffect(null)
      this.strokeNodeShape(canvas, node, this.auxStroke)
    }

    // Clip + render children for containers
    const isClippableContainer =
      node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
    if (isClippableContainer && node.clipsContent && node.childIds.length > 0) {
      canvas.save()
      canvas.clipRect(
        this.ck.LTRBRect(0, 0, node.width, node.height),
        this.ck.ClipOp.Intersect,
        true
      )
      for (const childId of node.childIds) {
        this.renderNode(canvas, graph, childId, overlays, absX, absY)
      }
      canvas.restore()
    } else {
      for (const childId of node.childIds) {
        this.renderNode(canvas, graph, childId, overlays, absX, absY)
      }
    }

    if (layerBlur) {
      canvas.restore()
    }
    if (node.opacity < 1) {
      canvas.restore()
    }
    canvas.restore()
  }

  private getVectorPath(node: SceneNode): Path | null {
    if (!node.vectorNetwork) return null
    const cached = this.vectorPathCache.get(node.id)
    if (cached) return cached
    const path = vectorNetworkToPath(this.ck, node.vectorNetwork)
    this.vectorPathCache.set(node.id, path)
    return path
  }

  invalidateVectorPath(nodeId: string): void {
    const old = this.vectorPathCache.get(nodeId)
    if (old) {
      old.delete()
      this.vectorPathCache.delete(nodeId)
    }
  }

  private strokeNodeShape(canvas: Canvas, node: SceneNode, paint: Paint): void {
    const rect = this.ck.LTRBRect(0, 0, node.width, node.height)

    switch (node.type) {
      case 'ELLIPSE':
        canvas.drawOval(rect, paint)
        return
      case 'VECTOR': {
        const vp = this.getVectorPath(node)
        if (vp) canvas.drawPath(vp, paint)
        return
      }
      case 'LINE':
        canvas.drawLine(0, 0, node.width, node.height, paint)
        return
      case 'POLYGON':
      case 'STAR': {
        const path = this.makePolygonPath(node)
        canvas.drawPath(path, paint)
        path.delete()
        return
      }
    }

    const hasRadius =
      node.cornerRadius > 0 ||
      (node.independentCorners &&
        (node.topLeftRadius > 0 ||
          node.topRightRadius > 0 ||
          node.bottomRightRadius > 0 ||
          node.bottomLeftRadius > 0))

    if (hasRadius) {
      if (node.independentCorners) {
        const rrect = new Float32Array([
          0,
          0,
          node.width,
          node.height,
          node.topLeftRadius,
          node.topLeftRadius,
          node.topRightRadius,
          node.topRightRadius,
          node.bottomRightRadius,
          node.bottomRightRadius,
          node.bottomLeftRadius,
          node.bottomLeftRadius
        ])
        canvas.drawRRect(rrect, paint)
      } else {
        canvas.drawRRect(this.ck.RRectXY(rect, node.cornerRadius, node.cornerRadius), paint)
      }
    } else {
      canvas.drawRect(rect, paint)
    }
  }

  private renderSection(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    const rect = this.ck.LTRBRect(0, 0, node.width, node.height)
    const rrect = this.ck.RRectXY(rect, SECTION_CORNER_RADIUS, SECTION_CORNER_RADIUS)

    // Fill
    for (let fi = 0; fi < node.fills.length; fi++) {
      const fill = node.fills[fi]!
      if (!fill.visible) continue
      this.applyFill(fill, node, graph, fi)
      this.fillPaint.setAlphaf(fill.opacity)
      canvas.drawRRect(rrect, this.fillPaint)
      this.fillPaint.setShader(null)
    }

    // Stroke
    for (let si = 0; si < node.strokes.length; si++) {
      const stroke = node.strokes[si]!
      if (!stroke.visible) continue
      const sc = this.resolveStrokeColor(stroke, si, node, graph)
      this.strokePaint.setColor(this.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
      this.strokePaint.setStrokeWidth(stroke.weight)
      this.strokePaint.setAlphaf(stroke.opacity)
      canvas.drawRRect(rrect, this.strokePaint)
    }
  }

  private drawSectionTitles(canvas: Canvas, graph: SceneGraph): void {
    if (!this.sectionTitleFont) return

    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
    if (!pageNode) return

    const sections: { node: SceneNode; absX: number; absY: number; nested: boolean }[] = []
    const collectSections = (parentId: string, ox: number, oy: number, insideSection: boolean) => {
      const parent = graph.getNode(parentId)
      if (!parent) return
      for (const childId of parent.childIds) {
        const child = graph.getNode(childId)
        if (!child || !child.visible) continue
        const ax = ox + child.x
        const ay = oy + child.y
        if (child.type === 'SECTION') {
          const vp = this.worldViewport
          if (
            ax + child.width >= vp.x &&
            ay + child.height >= vp.y &&
            ax <= vp.x + vp.w &&
            ay <= vp.y + vp.h
          ) {
            sections.push({ node: child, absX: ax, absY: ay, nested: insideSection })
          }
          collectSections(childId, ax, ay, true)
        } else if (child.childIds.length > 0) {
          collectSections(childId, ax, ay, insideSection)
        }
      }
    }
    collectSections(pageNode.id, 0, 0, false)

    const font = this.sectionTitleFont
    const ellipsis = '…'
    const ellipsisGlyphs = font.getGlyphIDs(ellipsis)
    const ellipsisWidth = font.getGlyphWidths(ellipsisGlyphs)[0]

    for (const { node, absX, absY, nested } of sections) {
      const screenX = absX * this.zoom + this.panX
      const screenY = absY * this.zoom + this.panY
      const screenW = node.width * this.zoom
      const maxPillW = Math.max(screenW, 0)

      const glyphIds = font.getGlyphIDs(node.name)
      const widths = font.getGlyphWidths(glyphIds)

      let fullTextWidth = 0
      for (const w of widths) fullTextWidth += w

      const maxTextW = maxPillW - SECTION_TITLE_PADDING_X * 2
      let displayText = node.name
      let textWidth = fullTextWidth

      if (textWidth > maxTextW && maxTextW > ellipsisWidth) {
        let truncW = 0
        let truncIdx = 0
        for (let i = 0; i < widths.length; i++) {
          if (truncW + widths[i] + ellipsisWidth > maxTextW) break
          truncW += widths[i]
          truncIdx = i + 1
        }
        displayText = node.name.slice(0, truncIdx) + ellipsis
        textWidth = truncW + ellipsisWidth
      } else if (maxTextW <= ellipsisWidth) {
        displayText = ellipsis
        textWidth = ellipsisWidth
      }

      const pillW = Math.min(textWidth + SECTION_TITLE_PADDING_X * 2, maxPillW)
      const pillH = SECTION_TITLE_HEIGHT
      const pillX = screenX
      const pillY = nested ? screenY + SECTION_TITLE_GAP : screenY - pillH - SECTION_TITLE_GAP

      if (node.fills.length > 0 && node.fills[0].visible) {
        const c = node.fills[0].color
        this.auxFill.setColor(this.ck.Color4f(c.r, c.g, c.b, node.fills[0].opacity))
      } else {
        this.auxFill.setColor(this.ck.Color4f(0.37, 0.37, 0.37, 1))
      }
      const pillRect = this.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH)
      canvas.drawRRect(
        this.ck.RRectXY(pillRect, SECTION_TITLE_RADIUS, SECTION_TITLE_RADIUS),
        this.auxFill
      )

      const pillColor =
        node.fills.length > 0 && node.fills[0].visible
          ? node.fills[0].color
          : { r: 0.37, g: 0.37, b: 0.37 }
      const lum = 0.299 * pillColor.r + 0.587 * pillColor.g + 0.114 * pillColor.b
      this.auxFill.setColor(lum > 0.5 ? this.ck.BLACK : this.ck.WHITE)
      const textY = pillY + pillH * 0.7
      canvas.drawText(displayText, pillX + SECTION_TITLE_PADDING_X, textY, this.auxFill, font)
    }
  }

  private drawComponentLabels(canvas: Canvas, graph: SceneGraph): void {
    if (!this.componentLabelFont) return

    const pageNode = graph.getNode(this.pageId ?? graph.rootId)
    if (!pageNode) return

    const font = this.componentLabelFont
    const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

    const nodes: { node: SceneNode; absX: number; absY: number; inside: boolean }[] = []
    const collect = (parentId: string, ox: number, oy: number) => {
      const parent = graph.getNode(parentId)
      if (!parent) return
      for (const childId of parent.childIds) {
        const child = graph.getNode(childId)
        if (!child || !child.visible) continue
        const ax = ox + child.x
        const ay = oy + child.y
        if (LABEL_TYPES.has(child.type)) {
          const vp = this.worldViewport
          if (
            ax + child.width >= vp.x &&
            ay + child.height >= vp.y &&
            ax <= vp.x + vp.w &&
            ay <= vp.y + vp.h
          ) {
            const isInsideSet = parent.type === 'COMPONENT_SET'
            nodes.push({ node: child, absX: ax, absY: ay, inside: isInsideSet })
          }
        }
        if (child.childIds.length > 0) {
          collect(childId, ax, ay)
        }
      }
    }
    collect(pageNode.id, 0, 0)

    const compColor = this.compColor()

    // Diamond icon path points (scaled to COMPONENT_LABEL_ICON_SIZE)
    const iconS = COMPONENT_LABEL_ICON_SIZE

    for (const { node, absX, absY, inside } of nodes) {
      const screenX = absX * this.zoom + this.panX
      const screenY = absY * this.zoom + this.panY

      // Position: inside top-left for variants in a set, above top-left otherwise
      const labelX = screenX
      let labelY: number
      if (inside) {
        labelY = screenY + COMPONENT_LABEL_GAP + COMPONENT_LABEL_FONT_SIZE
      } else {
        labelY = screenY - COMPONENT_LABEL_GAP
      }

      // Draw diamond icon
      const iconX = labelX
      const iconY = labelY - COMPONENT_LABEL_FONT_SIZE * 0.75
      const iconCx = iconX + iconS / 2
      const iconCy = iconY + iconS / 2
      const iconR = iconS / 2

      this.auxFill.setColor(compColor)

      if (node.type === 'COMPONENT_SET') {
        const s = iconR * 0.45
        const gap = iconR * 0.2
        const path = new this.ck.Path()
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ]) {
          const cx = iconCx + dx * (s + gap)
          const cy = iconCy + dy * (s + gap)
          path.moveTo(cx, cy - s)
          path.lineTo(cx + s, cy)
          path.lineTo(cx, cy + s)
          path.lineTo(cx - s, cy)
          path.close()
        }
        canvas.drawPath(path, this.auxFill)
        path.delete()
      } else {
        const path = new this.ck.Path()
        path.moveTo(iconCx, iconCy - iconR)
        path.lineTo(iconCx + iconR, iconCy)
        path.lineTo(iconCx, iconCy + iconR)
        path.lineTo(iconCx - iconR, iconCy)
        path.close()
        canvas.drawPath(path, this.auxFill)
        path.delete()
      }

      canvas.drawText(
        node.name,
        labelX + iconS + COMPONENT_LABEL_ICON_GAP,
        labelY,
        this.auxFill,
        font
      )
    }
  }

  private renderComponentSet(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    const rect = this.ck.LTRBRect(0, 0, node.width, node.height)
    const rrect = this.ck.RRectXY(rect, 5, 5)

    for (let fi = 0; fi < node.fills.length; fi++) {
      const fill = node.fills[fi]!
      if (!fill.visible) continue
      this.applyFill(fill, node, graph, fi)
      this.fillPaint.setAlphaf(fill.opacity)
      canvas.drawRRect(rrect, this.fillPaint)
      this.fillPaint.setShader(null)
    }

    this.auxStroke.setStrokeWidth(COMPONENT_SET_BORDER_WIDTH / this.zoom)
    this.auxStroke.setColor(this.compColor())
    this.auxStroke.setPathEffect(
      this.ck.PathEffect.MakeDash(
        [COMPONENT_SET_DASH / this.zoom, COMPONENT_SET_DASH_GAP / this.zoom],
        0
      )
    )
    canvas.drawRRect(rrect, this.auxStroke)
    this.auxStroke.setPathEffect(null)
  }

  private renderShape(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    const hasEffects = node.effects.length > 0 && node.effects.some((e) => e.visible)

    if (hasEffects) {
      const cached = this.nodePictureCache.get(node.id)
      if (cached) {
        canvas.drawPicture(cached)
        return
      }

      const margin = this.effectOverflow(node)
      const bounds = this.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
      const recorder = new this.ck.PictureRecorder()
      const recCanvas = recorder.beginRecording(bounds)
      this.renderShapeUncached(recCanvas, node, graph)
      const picture = recorder.finishRecordingAsPicture()
      recorder.delete()
      this.nodePictureCache.set(node.id, picture)
      canvas.drawPicture(picture)
    } else {
      this.renderShapeUncached(canvas, node, graph)
    }
  }

  private effectOverflow(node: SceneNode): number {
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

  private renderShapeUncached(canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
    const rect = this.ck.LTRBRect(0, 0, node.width, node.height)

    const hasRadius =
      node.cornerRadius > 0 ||
      (node.independentCorners &&
        (node.topLeftRadius > 0 ||
          node.topRightRadius > 0 ||
          node.bottomRightRadius > 0 ||
          node.bottomLeftRadius > 0))

    // Effects (behind: drop shadow)
    this.renderEffects(canvas, node, rect, hasRadius, 'behind')

    // Fills
    for (let fi = 0; fi < node.fills.length; fi++) {
      const fill = node.fills[fi]!
      if (!fill.visible) continue
      this.applyFill(fill, node, graph, fi)
      this.fillPaint.setAlphaf(fill.opacity)

      this.drawNodeFill(canvas, node, rect, hasRadius)
      this.fillPaint.setShader(null)
    }

    // Strokes
    for (let si = 0; si < node.strokes.length; si++) {
      const stroke = node.strokes[si]!
      if (!stroke.visible) continue
      const sc = this.resolveStrokeColor(stroke, si, node, graph)
      this.strokePaint.setColor(this.ck.Color4f(sc.r, sc.g, sc.b, sc.a))
      this.strokePaint.setStrokeWidth(stroke.weight)
      this.strokePaint.setAlphaf(stroke.opacity)

      if (stroke.cap) {
        const capMap: Record<string, EmbindEnumEntity> = {
          NONE: this.ck.StrokeCap.Butt,
          ROUND: this.ck.StrokeCap.Round,
          SQUARE: this.ck.StrokeCap.Square
        }
        this.strokePaint.setStrokeCap(capMap[stroke.cap] ?? this.ck.StrokeCap.Butt)
      }
      if (stroke.join) {
        const joinMap: Record<string, EmbindEnumEntity> = {
          MITER: this.ck.StrokeJoin.Miter,
          ROUND: this.ck.StrokeJoin.Round,
          BEVEL: this.ck.StrokeJoin.Bevel
        }
        this.strokePaint.setStrokeJoin(joinMap[stroke.join] ?? this.ck.StrokeJoin.Miter)
      }
      if (stroke.dashPattern && stroke.dashPattern.length > 0) {
        this.strokePaint.setPathEffect(this.ck.PathEffect.MakeDash(stroke.dashPattern, 0))
      } else {
        this.strokePaint.setPathEffect(null)
      }

      this.drawNodeStroke(canvas, node, rect, hasRadius)
    }

    // Effects (front: inner shadow, blur)
    this.renderEffects(canvas, node, rect, hasRadius, 'front')
  }

  private drawNodeFill(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean
  ): void {
    switch (node.type) {
      case 'VECTOR': {
        const vp = this.getVectorPath(node)
        if (vp) canvas.drawPath(vp, this.fillPaint)
        break
      }
      case 'ELLIPSE':
        if (node.arcData) {
          this.drawArc(canvas, node, this.fillPaint)
        } else {
          canvas.drawOval(rect, this.fillPaint)
        }
        break
      case 'TEXT':
        this.renderText(canvas, node)
        break
      case 'LINE':
        canvas.drawLine(0, 0, node.width, node.height, this.fillPaint)
        break
      case 'POLYGON':
      case 'STAR': {
        const path = this.makePolygonPath(node)
        canvas.drawPath(path, this.fillPaint)
        path.delete()
        break
      }
      default:
        if (hasRadius) {
          canvas.drawRRect(this.makeRRect(node), this.fillPaint)
        } else {
          canvas.drawRect(rect, this.fillPaint)
        }
    }
  }

  private drawNodeStroke(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean
  ): void {
    switch (node.type) {
      case 'VECTOR': {
        const vp = this.getVectorPath(node)
        if (vp) canvas.drawPath(vp, this.strokePaint)
        break
      }
      case 'ELLIPSE':
        if (node.arcData) {
          this.drawArc(canvas, node, this.strokePaint)
        } else {
          canvas.drawOval(rect, this.strokePaint)
        }
        break
      case 'POLYGON':
      case 'STAR': {
        const path = this.makePolygonPath(node)
        canvas.drawPath(path, this.strokePaint)
        path.delete()
        break
      }
      default:
        if (hasRadius) {
          canvas.drawRRect(this.makeRRect(node), this.strokePaint)
        } else {
          canvas.drawRect(rect, this.strokePaint)
        }
    }
  }

  private makePolygonPath(node: SceneNode): Path {
    const path = new this.ck.Path()
    const cx = node.width / 2
    const cy = node.height / 2
    const rx = node.width / 2
    const ry = node.height / 2
    const n = Math.max(3, node.pointCount)
    const isStar = node.type === 'STAR'
    const innerRatio = isStar ? node.starInnerRadius : 1
    const totalPoints = isStar ? n * 2 : n
    const angleOffset = -Math.PI / 2

    for (let i = 0; i < totalPoints; i++) {
      const angle = angleOffset + (2 * Math.PI * i) / totalPoints
      const isInner = isStar && i % 2 === 1
      const r = isInner ? innerRatio : 1
      const px = cx + rx * r * Math.cos(angle)
      const py = cy + ry * r * Math.sin(angle)
      if (i === 0) path.moveTo(px, py)
      else path.lineTo(px, py)
    }
    path.close()
    return path
  }

  private makeRRect(node: SceneNode): Float32Array {
    if (node.independentCorners) {
      return new Float32Array([
        0,
        0,
        node.width,
        node.height,
        node.topLeftRadius,
        node.topLeftRadius,
        node.topRightRadius,
        node.topRightRadius,
        node.bottomRightRadius,
        node.bottomRightRadius,
        node.bottomLeftRadius,
        node.bottomLeftRadius
      ])
    }
    return this.ck.RRectXY(
      this.ck.LTRBRect(0, 0, node.width, node.height),
      node.cornerRadius,
      node.cornerRadius
    )
  }

  private getCachedDropShadow(
    dx: number,
    dy: number,
    sigma: number,
    color: Float32Array
  ): ImageFilter {
    const key = `ds:${dx},${dy},${sigma},${color[0]},${color[1]},${color[2]},${color[3]}`
    let filter = this.imageFilterCache.get(key)
    if (!filter) {
      filter = this.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
      this.imageFilterCache.set(key, filter)
    }
    return filter
  }

  private getCachedBlur(sigma: number): ImageFilter {
    const key = `blur:${sigma}`
    let filter = this.imageFilterCache.get(key)
    if (!filter) {
      filter = this.ck.ImageFilter.MakeBlur(sigma, sigma, this.ck.TileMode.Clamp, null)
      this.imageFilterCache.set(key, filter)
    }
    return filter
  }

  private getCachedDecalBlur(sigma: number): ImageFilter {
    const key = `dblur:${sigma}`
    let filter = this.imageFilterCache.get(key)
    if (!filter) {
      filter = this.ck.ImageFilter.MakeBlur(sigma, sigma, this.ck.TileMode.Decal, null)
      this.imageFilterCache.set(key, filter)
    }
    return filter
  }

  private getCachedMaskBlur(sigma: number): MaskFilter {
    let filter = this.maskFilterCache.get(sigma)
    if (!filter) {
      filter = this.ck.MaskFilter.MakeBlur(this.ck.BlurStyle.Normal, sigma, true)
      this.maskFilterCache.set(sigma, filter)
    }
    return filter
  }

  private applyClippedBlur(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    sigma: number
  ): void {
    canvas.save()
    this.clipNodeShape(canvas, node, rect, hasRadius)
    this.effectLayerPaint.setImageFilter(this.getCachedBlur(sigma))
    canvas.saveLayer(this.effectLayerPaint)
    canvas.restore()
    canvas.restore()
  }

  private clipNodeShape(canvas: Canvas, node: SceneNode, rect: Float32Array, hasRadius: boolean): void {
    if (node.type === 'ELLIPSE') {
      const clipPath = new this.ck.Path()
      clipPath.addOval(rect)
      canvas.clipPath(clipPath, this.ck.ClipOp.Intersect, true)
      clipPath.delete()
    } else if (hasRadius) {
      canvas.clipRRect(this.makeRRect(node), this.ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRect(rect, this.ck.ClipOp.Intersect, true)
    }
  }

  private makeRRectWithSpread(node: SceneNode, spread: number): Float32Array {
    if (node.independentCorners) {
      return new Float32Array([
        -spread,
        -spread,
        node.width + spread,
        node.height + spread,
        Math.max(0, node.topLeftRadius + spread),
        Math.max(0, node.topLeftRadius + spread),
        Math.max(0, node.topRightRadius + spread),
        Math.max(0, node.topRightRadius + spread),
        Math.max(0, node.bottomRightRadius + spread),
        Math.max(0, node.bottomRightRadius + spread),
        Math.max(0, node.bottomLeftRadius + spread),
        Math.max(0, node.bottomLeftRadius + spread)
      ])
    }
    return this.ck.RRectXY(
      this.ck.LTRBRect(-spread, -spread, node.width + spread, node.height + spread),
      Math.max(0, node.cornerRadius + spread),
      Math.max(0, node.cornerRadius + spread)
    )
  }

  private makeRRectWithOffset(node: SceneNode, ox: number, oy: number, spread: number): Float32Array {
    const s = spread
    if (node.independentCorners) {
      return new Float32Array([
        ox + s,
        oy + s,
        node.width + ox - s,
        node.height + oy - s,
        Math.max(0, node.topLeftRadius - s),
        Math.max(0, node.topLeftRadius - s),
        Math.max(0, node.topRightRadius - s),
        Math.max(0, node.topRightRadius - s),
        Math.max(0, node.bottomRightRadius - s),
        Math.max(0, node.bottomRightRadius - s),
        Math.max(0, node.bottomLeftRadius - s),
        Math.max(0, node.bottomLeftRadius - s)
      ])
    }
    return this.ck.RRectXY(
      this.ck.LTRBRect(ox + s, oy + s, node.width + ox - s, node.height + oy - s),
      Math.max(0, node.cornerRadius - s),
      Math.max(0, node.cornerRadius - s)
    )
  }

  private drawArc(canvas: Canvas, node: SceneNode, paint: Paint): void {
    const arc = node.arcData
    if (!arc) return
    const cx = node.width / 2
    const cy = node.height / 2
    const rx = node.width / 2
    const ry = node.height / 2
    const innerRx = rx * arc.innerRadius
    const innerRy = ry * arc.innerRadius

    const startDeg = arc.startingAngle * (180 / Math.PI)
    const endDeg = arc.endingAngle * (180 / Math.PI)
    const sweepDeg = endDeg - startDeg

    const path = new this.ck.Path()
    const oval = this.ck.LTRBRect(0, 0, node.width, node.height)

    if (arc.innerRadius > 0) {
      // Donut shape
      path.addArc(oval, startDeg, sweepDeg)
      const innerOval = this.ck.LTRBRect(cx - innerRx, cy - innerRy, cx + innerRx, cy + innerRy)
      const innerPath = new this.ck.Path()
      innerPath.addArc(innerOval, startDeg + sweepDeg, -sweepDeg)
      path.addPath(innerPath)
      path.close()
      innerPath.delete()
    } else {
      const isFullCircle = Math.abs(sweepDeg) >= 359.99
      if (isFullCircle) {
        path.addOval(oval)
      } else {
        path.moveTo(cx, cy)
        path.addArc(oval, startDeg, sweepDeg)
        path.close()
      }
    }

    canvas.drawPath(path, paint)
    path.delete()
  }

  private renderEffects(
    canvas: Canvas,
    node: SceneNode,
    rect: Float32Array,
    hasRadius: boolean,
    pass: 'behind' | 'front'
  ): void {
    for (const effect of node.effects) {
      if (!effect.visible) continue

      if (pass === 'behind' && effect.type === 'DROP_SHADOW') {
        const sp = effect.spread
        const sigma = effect.radius / 2

        if (node.type === 'TEXT') {
          const shadowColor = this.ck.Color4f(
            effect.color.r,
            effect.color.g,
            effect.color.b,
            effect.color.a
          )
          const dropFilter = this.getCachedDropShadow(
            effect.offset.x,
            effect.offset.y,
            sigma,
            shadowColor
          )
          this.effectLayerPaint.setImageFilter(dropFilter)
          canvas.saveLayer(this.effectLayerPaint)
          this.renderText(canvas, node)
          canvas.restore()
        } else {
          this.auxFill.setColor(
            this.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
          )
          this.auxFill.setMaskFilter(this.getCachedMaskBlur(sigma))
          this.auxFill.setImageFilter(null)
          canvas.save()
          canvas.translate(effect.offset.x, effect.offset.y)
          if (node.type === 'ELLIPSE') {
            canvas.drawOval(this.ltrb(-sp, -sp, node.width + sp, node.height + sp), this.auxFill)
          } else if (hasRadius) {
            canvas.drawRRect(this.makeRRectWithSpread(node, sp), this.auxFill)
          } else {
            canvas.drawRect(this.ltrb(-sp, -sp, node.width + sp, node.height + sp), this.auxFill)
          }
          canvas.restore()
          this.auxFill.setMaskFilter(null)
        }
      }

      if (
        (pass === 'behind' && effect.type === 'BACKGROUND_BLUR') ||
        (pass === 'front' && effect.type === 'FOREGROUND_BLUR')
      ) {
        this.applyClippedBlur(canvas, node, rect, hasRadius, effect.radius / 2)
      }

      if (pass === 'front' && effect.type === 'INNER_SHADOW') {
        if (node.type === 'TEXT') {
          this.effectLayerPaint.setImageFilter(this.getCachedDecalBlur(effect.radius))
          this.effectLayerPaint.setColorFilter(
            this.ck.ColorFilter.MakeBlend(
              this.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
              this.ck.BlendMode.SrcIn
            )
          )
          canvas.saveLayer(this.effectLayerPaint)
          canvas.save()
          canvas.translate(effect.offset.x, effect.offset.y)
          this.renderText(canvas, node)
          canvas.restore()
          canvas.restore()
          this.effectLayerPaint.setColorFilter(null)
          continue
        }
        const sp = effect.spread
        this.auxFill.setColor(
          this.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
        )
        this.auxFill.setImageFilter(this.getCachedDecalBlur(effect.radius))

        canvas.save()
        if (node.type === 'ELLIPSE') {
          const path = new this.ck.Path()
          path.addOval(rect)
          canvas.clipPath(path, this.ck.ClipOp.Intersect, true)
          path.delete()
        } else if (hasRadius) {
          canvas.clipRRect(this.makeRRect(node), this.ck.ClipOp.Intersect, true)
        } else {
          canvas.clipRect(rect, this.ck.ClipOp.Intersect, true)
        }

        const expand = effect.radius * 2
        const big = this.ck.LTRBRect(
          -expand + effect.offset.x,
          -expand + effect.offset.y,
          node.width + expand + effect.offset.x,
          node.height + expand + effect.offset.y
        )
        const bigPath = new this.ck.Path()
        bigPath.addRect(big)
        if (node.type === 'ELLIPSE') {
          const innerPath = new this.ck.Path()
          const offsetRect = this.ck.LTRBRect(
            effect.offset.x + sp,
            effect.offset.y + sp,
            node.width + effect.offset.x - sp,
            node.height + effect.offset.y - sp
          )
          innerPath.addOval(offsetRect)
          bigPath.op(innerPath, this.ck.PathOp.Difference)
          innerPath.delete()
        } else if (hasRadius) {
          const innerPath = new this.ck.Path()
          innerPath.addRRect(this.makeRRectWithOffset(node, effect.offset.x + sp, effect.offset.y + sp, -sp))
          bigPath.op(innerPath, this.ck.PathOp.Difference)
          innerPath.delete()
        } else {
          const innerPath = new this.ck.Path()
          innerPath.addRect(
            this.ck.LTRBRect(
              effect.offset.x + sp,
              effect.offset.y + sp,
              node.width + effect.offset.x - sp,
              node.height + effect.offset.y - sp
            )
          )
          bigPath.op(innerPath, this.ck.PathOp.Difference)
          innerPath.delete()
        }
        canvas.drawPath(bigPath, this.auxFill)
        bigPath.delete()
        canvas.restore()
        this.auxFill.setImageFilter(null)
      }
    }
  }

  private renderText(canvas: Canvas, node: SceneNode): void {
    const text = node.text
    if (!text) return

    if (this.fontsLoaded && this.fontProvider) {
      if (this.isNodeFontLoaded(node)) {
        const paragraph = this.buildParagraph(node, this.fillPaint.getColor())
        canvas.drawParagraph(paragraph, 0, 0)
        paragraph.delete()
      } else if (node.textPicture) {
        const pic = this.ck.MakePicture(node.textPicture)
        if (pic) {
          canvas.drawPicture(pic)
          pic.delete()
        }
      } else if (this.textFont) {
        canvas.drawText(text, 0, node.fontSize || DEFAULT_FONT_SIZE, this.fillPaint, this.textFont)
      }
    } else if (this.textFont) {
      canvas.drawText(text, 0, node.fontSize || DEFAULT_FONT_SIZE, this.fillPaint, this.textFont)
    }
  }

  isNodeFontLoaded(node: SceneNode): boolean {
    const families = new Set<string>()
    families.add(node.fontFamily || 'Inter')
    for (const run of node.styleRuns) {
      if (run.style.fontFamily) families.add(run.style.fontFamily)
    }
    return [...families].every((f) => isFontLoaded(f))
  }

  buildTextPicture(node: SceneNode): Uint8Array | null {
    if (!this.fontsLoaded || !this.fontProvider || !this.isNodeFontLoaded(node)) return null
    if (node.type !== 'TEXT' || !node.text) return null

    const ck = this.ck
    const recorder = new ck.PictureRecorder()
    const bounds = ck.LTRBRect(0, 0, node.width || 1e6, node.height || 1e6)
    const recCanvas = recorder.beginRecording(bounds)

    const paragraph = this.buildParagraph(node)
    recCanvas.drawParagraph(paragraph, 0, 0)
    paragraph.delete()

    const picture = recorder.finishRecordingAsPicture()
    recorder.delete()

    const bytes = picture.serialize()
    picture.delete()
    return bytes ?? null
  }

  buildParagraph(node: SceneNode, color?: Float32Array): import('canvaskit-wasm').Paragraph {
    const ck = this.ck
    const baseColor = color ?? ck.BLACK
    const baseFontSize = node.fontSize || DEFAULT_FONT_SIZE

    const paraStyle = new ck.ParagraphStyle({
      textAlign: this.getTextAlign(node.textAlignHorizontal),
      textStyle: {
        color: baseColor,
        fontFamilies: [node.fontFamily || 'Inter'],
        fontSize: baseFontSize,
        fontStyle: {
          weight: { value: node.fontWeight || 400 } as FontWeight,
          slant: node.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
        },
        letterSpacing: node.letterSpacing || 0,
        decoration: this.textDecorationValue(node.textDecoration),
        heightMultiplier: node.lineHeight ? node.lineHeight / baseFontSize : undefined
      }
    })

    const builder = ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, this.fontProvider!)
    const runs = node.styleRuns
    const text = node.text

    if (runs.length === 0) {
      builder.addText(text)
    } else {
      let pos = 0
      for (const run of runs) {
        if (pos < run.start) {
          builder.addText(text.slice(pos, run.start))
        }
        const s = run.style
        builder.pushStyle(
          new ck.TextStyle({
            color: baseColor,
            fontFamilies: [s.fontFamily ?? (node.fontFamily || 'Inter')],
            fontSize: s.fontSize ?? baseFontSize,
            fontStyle: {
              weight: { value: (s.fontWeight ?? node.fontWeight) || 400 } as FontWeight,
              slant: (s.italic ?? node.italic) ? ck.FontSlant.Italic : ck.FontSlant.Upright
            },
            letterSpacing: s.letterSpacing ?? (node.letterSpacing || 0),
            decoration: this.textDecorationValue(s.textDecoration ?? node.textDecoration),
            heightMultiplier: (s.lineHeight !== undefined ? s.lineHeight : node.lineHeight)
              ? (s.lineHeight !== undefined ? s.lineHeight : node.lineHeight)! /
                (s.fontSize ?? baseFontSize)
              : undefined
          })
        )
        builder.addText(text.slice(run.start, run.start + run.length))
        builder.pop()
        pos = run.start + run.length
      }
      if (pos < text.length) {
        builder.addText(text.slice(pos))
      }
    }

    const paragraph = builder.build()
    paragraph.layout(node.width || 1e6)
    builder.delete()
    return paragraph
  }

  private textDecorationValue(decoration: string): number {
    switch (decoration) {
      case 'UNDERLINE':
        return this.ck.UnderlineDecoration
      case 'STRIKETHROUGH':
        return this.ck.LineThroughDecoration
      default:
        return this.ck.NoDecoration
    }
  }

  private getTextAlign(align: string) {
    switch (align) {
      case 'CENTER':
        return this.ck.TextAlign.Center
      case 'RIGHT':
        return this.ck.TextAlign.Right
      case 'JUSTIFIED':
        return this.ck.TextAlign.Justify
      default:
        return this.ck.TextAlign.Left
    }
  }

  private drawTextEditOverlay(canvas: Canvas, node: SceneNode, editor: TextEditor): void {
    this.auxStroke.setStrokeWidth(1 / this.zoom)
    this.auxStroke.setColor(this.selColor())
    this.auxStroke.setPathEffect(null)
    canvas.drawRect(this.ck.LTRBRect(0, 0, node.width, node.height), this.auxStroke)

    const selRects = editor.getSelectionRects()
    if (selRects.length > 0) {
      this.auxFill.setColor(
        this.ck.Color4f(
          TEXT_SELECTION_COLOR.r,
          TEXT_SELECTION_COLOR.g,
          TEXT_SELECTION_COLOR.b,
          TEXT_SELECTION_COLOR.a
        )
      )
      for (const r of selRects) {
        canvas.drawRect(this.ck.LTRBRect(r.x, r.y, r.x + r.width, r.y + r.height), this.auxFill)
      }
    }

    if (editor.caretVisible && !editor.hasSelection()) {
      const caret = editor.getCaretRect()
      if (caret) {
        this.auxFill.setColor(
          this.ck.Color4f(
            TEXT_CARET_COLOR.r,
            TEXT_CARET_COLOR.g,
            TEXT_CARET_COLOR.b,
            TEXT_CARET_COLOR.a
          )
        )
        const w = TEXT_CARET_WIDTH / this.zoom
        canvas.drawRect(
          this.ck.LTRBRect(caret.x - w / 2, caret.y0, caret.x + w / 2, caret.y1),
          this.auxFill
        )
      }
    }
  }

  resolveFillColor(fill: Fill, fillIndex: number, node: SceneNode, graph: SceneGraph): Color {
    const varId = node.boundVariables[`fills/${fillIndex}/color`]
    if (varId) {
      const resolved = graph.resolveColorVariable(varId)
      if (resolved) return resolved
    }
    return fill.color
  }

  resolveStrokeColor(
    stroke: Stroke,
    strokeIndex: number,
    node: SceneNode,
    graph: SceneGraph
  ): Color {
    const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
    if (varId) {
      const resolved = graph.resolveColorVariable(varId)
      if (resolved) return resolved
    }
    return stroke.color
  }

  private applyFill(fill: Fill, node: SceneNode, graph: SceneGraph, fillIndex = 0): void {
    this.fillPaint.setShader(null)

    if (fill.type === 'SOLID') {
      const c = this.resolveFillColor(fill, fillIndex, node, graph)
      this.fillPaint.setColor(this.ck.Color4f(c.r, c.g, c.b, c.a))
      return
    }

    if (fill.type.startsWith('GRADIENT') && fill.gradientStops && fill.gradientTransform) {
      this.applyGradientFill(fill, node)
      return
    }

    if (fill.type === 'IMAGE' && fill.imageHash) {
      this.applyImageFill(fill, node, graph)
      return
    }
  }

  private applyGradientFill(fill: Fill, node: SceneNode): void {
    const stops = fill.gradientStops
    const t = fill.gradientTransform
    if (!stops || !t) return
    const colors = stops.map((s) => this.ck.Color4f(s.color.r, s.color.g, s.color.b, s.color.a))
    const positions = stops.map((s) => s.position)

    // Figma gradient transform maps unit square to node bounds
    // Convert transform to canvas coordinates
    const w = node.width
    const h = node.height

    if (fill.type === 'GRADIENT_LINEAR') {
      // Start and end points derived from transform
      const startX = t.m02 * w
      const startY = t.m12 * h
      const endX = (t.m00 + t.m02) * w
      const endY = (t.m10 + t.m12) * h
      const shader = this.ck.Shader.MakeLinearGradient(
        [startX, startY],
        [endX, endY],
        colors,
        positions,
        this.ck.TileMode.Clamp
      )
      this.fillPaint.setShader(shader)
    } else if (fill.type === 'GRADIENT_RADIAL') {
      const cx = t.m02 * w
      const cy = t.m12 * h
      const radius = Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * Math.max(w, h)
      const shader = this.ck.Shader.MakeRadialGradient(
        [cx, cy],
        radius,
        colors,
        positions,
        this.ck.TileMode.Clamp
      )
      this.fillPaint.setShader(shader)
    } else if (fill.type === 'GRADIENT_ANGULAR') {
      const cx = t.m02 * w
      const cy = t.m12 * h
      const shader = this.ck.Shader.MakeSweepGradient(
        cx,
        cy,
        colors,
        positions,
        this.ck.TileMode.Clamp,
        // Figma angular gradients start from right (0°), CanvasKit sweep from right too
        undefined
      )
      this.fillPaint.setShader(shader)
    } else if (fill.type === 'GRADIENT_DIAMOND') {
      // Diamond gradient approximated as radial
      const cx = t.m02 * w
      const cy = t.m12 * h
      const radius = Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * Math.max(w, h)
      const shader = this.ck.Shader.MakeRadialGradient(
        [cx, cy],
        radius,
        colors,
        positions,
        this.ck.TileMode.Clamp
      )
      this.fillPaint.setShader(shader)
    }
  }

  private applyImageFill(fill: Fill, node: SceneNode, graph: SceneGraph): void {
    const hash = fill.imageHash
    if (!hash) return
    let img = this.imageCache.get(hash)
    if (!img) {
      const data = graph.images.get(hash)
      if (!data) return
      img = this.ck.MakeImageFromEncoded(data) ?? undefined
      if (img) this.imageCache.set(hash, img)
      else return
    }

    const imgW = img.width()
    const imgH = img.height()
    const scaleMode = fill.imageScaleMode ?? 'FILL'

    let sx: number, sy: number, sw: number, sh: number
    if (scaleMode === 'FILL') {
      const scale = Math.max(node.width / imgW, node.height / imgH)
      sw = node.width / scale
      sh = node.height / scale
      sx = (imgW - sw) / 2
      sy = (imgH - sh) / 2
    } else if (scaleMode === 'FIT') {
      sw = imgW
      sh = imgH
      sx = 0
      sy = 0
      // FIT: image centered within bounds — handled by shader matrix
    } else {
      sx = 0
      sy = 0
      sw = imgW
      sh = imgH
    }

    const shader = img.makeShaderCubic(
      this.ck.TileMode.Clamp,
      this.ck.TileMode.Clamp,
      1 / 3,
      1 / 3,
      this.ck.Matrix.multiply(
        this.ck.Matrix.scaled(node.width / sw, node.height / sh),
        this.ck.Matrix.translated(-sx, -sy)
      )
    )
    this.fillPaint.setShader(shader)
  }

  screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    }
  }

  private drawPenOverlay(canvas: Canvas, penState: RenderOverlays['penState']): void {
    if (!penState || penState.vertices.length === 0) return

    const { vertices, segments, dragTangent, cursorX, cursorY } = penState
    const pathPaint = this.penPathPaint
    const handlePaint = this.penHandlePaint
    const vertexFill = this.penVertexFill
    const vertexStroke = this.penVertexStroke

    const toScreen = (x: number, y: number) => ({
      x: x * this.zoom + this.panX,
      y: y * this.zoom + this.panY
    })

    // Draw existing segments
    const path = new this.ck.Path()
    for (const seg of segments) {
      const s = toScreen(vertices[seg.start].x, vertices[seg.start].y)
      const e = toScreen(vertices[seg.end].x, vertices[seg.end].y)
      path.moveTo(s.x, s.y)

      const isLine =
        seg.tangentStart.x === 0 &&
        seg.tangentStart.y === 0 &&
        seg.tangentEnd.x === 0 &&
        seg.tangentEnd.y === 0
      if (isLine) {
        path.lineTo(e.x, e.y)
      } else {
        const cp1 = toScreen(
          vertices[seg.start].x + seg.tangentStart.x,
          vertices[seg.start].y + seg.tangentStart.y
        )
        const cp2 = toScreen(
          vertices[seg.end].x + seg.tangentEnd.x,
          vertices[seg.end].y + seg.tangentEnd.y
        )
        path.cubicTo(cp1.x, cp1.y, cp2.x, cp2.y, e.x, e.y)
      }
    }

    // Preview line from last vertex to cursor
    if (vertices.length > 0 && cursorX != null && cursorY != null) {
      const last = toScreen(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y)
      const cursor = toScreen(cursorX, cursorY)
      path.moveTo(last.x, last.y)
      if (dragTangent) {
        const cp1 = toScreen(
          vertices[vertices.length - 1].x + dragTangent.x,
          vertices[vertices.length - 1].y + dragTangent.y
        )
        path.cubicTo(cp1.x, cp1.y, cursor.x, cursor.y, cursor.x, cursor.y)
      } else {
        path.lineTo(cursor.x, cursor.y)
      }
    }

    canvas.drawPath(path, pathPaint)
    path.delete()

    // Draw tangent handle lines
    for (const seg of segments) {
      const ts = seg.tangentStart
      const te = seg.tangentEnd
      if (ts.x !== 0 || ts.y !== 0) {
        const s = toScreen(vertices[seg.start].x, vertices[seg.start].y)
        const cp = toScreen(vertices[seg.start].x + ts.x, vertices[seg.start].y + ts.y)
        canvas.drawLine(s.x, s.y, cp.x, cp.y, handlePaint)
        canvas.drawCircle(cp.x, cp.y, PEN_HANDLE_RADIUS, vertexFill)
        canvas.drawCircle(cp.x, cp.y, PEN_HANDLE_RADIUS, handlePaint)
      }
      if (te.x !== 0 || te.y !== 0) {
        const e = toScreen(vertices[seg.end].x, vertices[seg.end].y)
        const cp = toScreen(vertices[seg.end].x + te.x, vertices[seg.end].y + te.y)
        canvas.drawLine(e.x, e.y, cp.x, cp.y, handlePaint)
        canvas.drawCircle(cp.x, cp.y, PEN_HANDLE_RADIUS, vertexFill)
        canvas.drawCircle(cp.x, cp.y, PEN_HANDLE_RADIUS, handlePaint)
      }
    }

    // Draw current drag tangent handles
    if (dragTangent && vertices.length > 0) {
      const last = vertices[vertices.length - 1]
      const cp1 = toScreen(last.x + dragTangent.x, last.y + dragTangent.y)
      const cp2 = toScreen(last.x - dragTangent.x, last.y - dragTangent.y)
      canvas.drawLine(cp2.x, cp2.y, cp1.x, cp1.y, handlePaint)
      canvas.drawCircle(cp1.x, cp1.y, PEN_HANDLE_RADIUS, vertexFill)
      canvas.drawCircle(cp1.x, cp1.y, PEN_HANDLE_RADIUS, handlePaint)
      canvas.drawCircle(cp2.x, cp2.y, PEN_HANDLE_RADIUS, vertexFill)
      canvas.drawCircle(cp2.x, cp2.y, PEN_HANDLE_RADIUS, handlePaint)
    }

    // Draw vertices
    for (let i = 0; i < vertices.length; i++) {
      const v = toScreen(vertices[i].x, vertices[i].y)
      const radius =
        i === 0 && penState.closingToFirst
          ? PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST
          : PEN_VERTEX_RADIUS
      canvas.drawCircle(v.x, v.y, radius, vertexFill)
      canvas.drawCircle(v.x, v.y, radius, vertexStroke)
    }
  }

  // --- Remote Cursors ---

  private drawRemoteCursors(
    canvas: Canvas,
    graph: SceneGraph,
    cursors?: RenderOverlays['remoteCursors']
  ): void {
    if (!cursors || cursors.length === 0) return

    const CURSOR_SIZE = 9
    const LABEL_PADDING_X = 4
    const LABEL_PADDING_Y = 2
    const LABEL_FONT_SIZE = 10
    const LABEL_OFFSET_X = 12
    const LABEL_OFFSET_Y = 20

    for (const cursor of cursors) {
      const screenX = cursor.x * this.zoom + this.panX
      const screenY = cursor.y * this.zoom + this.panY
      const { r, g, b } = cursor.color

      // Draw remote selections
      if (cursor.selection?.length) {
        this.auxStroke.setColor(this.ck.Color4f(r, g, b, 0.6))
        this.auxStroke.setStrokeWidth(1.5)
        this.auxStroke.setPathEffect(null)
        for (const nodeId of cursor.selection) {
          const node = graph.getNode(nodeId)
          if (!node) continue
          const abs = graph.getAbsolutePosition(nodeId)
          const sx = abs.x * this.zoom + this.panX
          const sy = abs.y * this.zoom + this.panY
          const sw = node.width * this.zoom
          const sh = node.height * this.zoom
          canvas.drawRect(this.ck.XYWHRect(sx, sy, sw, sh), this.auxStroke)
        }
      }

      // Figma-style cursor arrow
      const S = CURSOR_SIZE
      const path = new this.ck.Path()
      path.moveTo(screenX, screenY)
      path.lineTo(screenX, screenY + S * 1.35)
      path.lineTo(screenX + S * 0.38, screenY + S * 1.0)
      path.lineTo(screenX + S * 0.72, screenY + S * 1.5)
      path.lineTo(screenX + S * 0.92, screenY + S * 1.38)
      path.lineTo(screenX + S * 0.58, screenY + S * 0.88)
      path.lineTo(screenX + S * 1.0, screenY + S * 0.82)
      path.close()

      // White border for contrast
      this.auxStroke.setColor(this.ck.Color4f(1, 1, 1, 1))
      this.auxStroke.setStrokeWidth(2)
      this.auxStroke.setPathEffect(null)
      canvas.drawPath(path, this.auxStroke)

      // Filled arrow in peer color
      this.auxFill.setColor(this.ck.Color4f(r, g, b, 1))
      canvas.drawPath(path, this.auxFill)
      path.delete()

      // Draw name label
      if (cursor.name) {
        const font = this.labelFont
        if (font) {
          font.setSize(LABEL_FONT_SIZE)
          const labelX = screenX + LABEL_OFFSET_X
          const labelY = screenY + LABEL_OFFSET_Y
          const glyphIds = font.getGlyphIDs(cursor.name)
          const widths = font.getGlyphWidths(glyphIds)
          let textWidth = 0
          for (let i = 0; i < widths.length; i++) textWidth += widths[i]

          // Label background (pill)
          this.auxFill.setColor(this.ck.Color4f(r, g, b, 1))
          const bgRect = this.ck.RRectXY(
            this.ck.XYWHRect(
              labelX - LABEL_PADDING_X,
              labelY - LABEL_FONT_SIZE - LABEL_PADDING_Y + 2,
              textWidth + LABEL_PADDING_X * 2,
              LABEL_FONT_SIZE + LABEL_PADDING_Y * 2
            ),
            4,
            4
          )
          canvas.drawRRect(bgRect, this.auxFill)

          // Label text
          this.auxFill.setColor(this.ck.Color4f(1, 1, 1, 1))
          canvas.drawText(cursor.name, labelX, labelY, this.auxFill, font)
        }
      }
    }
  }

  // --- Rulers ---

  private drawRulers(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
    const R = RULER_SIZE
    const vw = this.viewportWidth
    const vh = this.viewportHeight
    if (vw === 0 || vh === 0) return

    const bgPaint = this.rulerBgPaint
    const tickPaint = this.rulerTickPaint
    const textPaint = this.rulerTextPaint

    canvas.drawRect(this.ck.LTRBRect(0, 0, vw, R), bgPaint)
    canvas.drawRect(this.ck.LTRBRect(0, R, R, vh), bgPaint)

    // Corner square
    canvas.drawRect(this.ck.LTRBRect(0, 0, R, R), bgPaint)

    const font = this.sizeFont ?? this.textFont
    if (!font) return

    const step = this.rulerStep()
    const minorStep = step / 5

    // Compute selection bounds for badge exclusion zones
    let sx1 = -Infinity,
      sx2 = -Infinity,
      sy1 = -Infinity,
      sy2 = -Infinity
    const selNodes = [...selectedIds]
      .map((id) => graph.getNode(id))
      .filter((n): n is SceneNode => n !== undefined)
    if (selNodes.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const n of selNodes) {
        const abs = graph.getAbsolutePosition(n.id)
        minX = Math.min(minX, abs.x)
        minY = Math.min(minY, abs.y)
        maxX = Math.max(maxX, abs.x + n.width)
        maxY = Math.max(maxY, abs.y + n.height)
      }
      sx1 = minX * this.zoom + this.panX
      sx2 = maxX * this.zoom + this.panX
      sy1 = minY * this.zoom + this.panY
      sy2 = maxY * this.zoom + this.panY
    }

    const badgeW = RULER_BADGE_EXCLUSION

    // Horizontal ruler (clipped)
    canvas.save()
    canvas.clipRect(this.ck.LTRBRect(R, 0, vw, R), this.ck.ClipOp.Intersect, false)
    const worldLeft = -this.panX / this.zoom
    const worldRight = (vw - this.panX) / this.zoom
    const startX = Math.floor(worldLeft / step) * step

    for (let wx = startX; wx <= worldRight; wx += minorStep) {
      const sx = wx * this.zoom + this.panX
      if (sx < R) continue
      const isMajor = Math.abs(wx % step) < RULER_MAJOR_TOLERANCE
      const tickLen = isMajor ? R * RULER_MAJOR_TICK : R * RULER_MINOR_TICK
      canvas.drawLine(sx, R - tickLen, sx, R, tickPaint)

      if (isMajor && selNodes.length > 0) {
        const tooClose = Math.abs(sx - sx1) < badgeW || Math.abs(sx - sx2) < badgeW
        if (!tooClose) {
          canvas.drawText(this.rulerLabel(wx), sx + 2, R * RULER_TEXT_BASELINE, textPaint, font)
        }
      } else if (isMajor) {
        canvas.drawText(this.rulerLabel(wx), sx + 2, R * RULER_TEXT_BASELINE, textPaint, font)
      }
    }
    canvas.restore()

    // Vertical ruler (clipped)
    canvas.save()
    canvas.clipRect(this.ck.LTRBRect(0, R, R, vh), this.ck.ClipOp.Intersect, false)
    const worldTop = -this.panY / this.zoom
    const worldBottom = (vh - this.panY) / this.zoom
    const startY = Math.floor(worldTop / step) * step

    for (let wy = startY; wy <= worldBottom; wy += minorStep) {
      const sy = wy * this.zoom + this.panY
      if (sy < R) continue
      const isMajor = Math.abs(wy % step) < RULER_MAJOR_TOLERANCE
      const tickLen = isMajor ? R * RULER_MAJOR_TICK : R * RULER_MINOR_TICK
      canvas.drawLine(R - tickLen, sy, R, sy, tickPaint)

      if (isMajor && selNodes.length > 0) {
        const tooClose = Math.abs(sy - sy1) < badgeW || Math.abs(sy - sy2) < badgeW
        if (!tooClose) {
          canvas.save()
          canvas.translate(R * RULER_TEXT_BASELINE, sy - 2)
          canvas.rotate(-90, 0, 0)
          canvas.drawText(this.rulerLabel(wy), 0, 3, textPaint, font)
          canvas.restore()
        }
      } else if (isMajor) {
        canvas.save()
        canvas.translate(R * RULER_TEXT_BASELINE, sy - 2)
        canvas.rotate(-90, 0, 0)
        canvas.drawText(this.rulerLabel(wy), 0, 3, textPaint, font)
        canvas.restore()
      }
    }
    canvas.restore()

    // Selection highlight + badges
    if (selNodes.length > 0) {
      this.rulerHlPaint.setColor(this.selColor(RULER_HIGHLIGHT_ALPHA))

      canvas.drawRect(this.ck.LTRBRect(Math.max(R, sx1), 0, sx2, R), this.rulerHlPaint)
      canvas.drawRect(this.ck.LTRBRect(0, Math.max(R, sy1), R, sy2), this.rulerHlPaint)

      this.drawRulerBadge(
        canvas,
        font,
        Math.round((sx1 - this.panX) / this.zoom).toString(),
        Math.max(R, sx1),
        0,
        'horizontal'
      )
      this.drawRulerBadge(
        canvas,
        font,
        Math.round((sx2 - this.panX) / this.zoom).toString(),
        sx2,
        0,
        'horizontal'
      )
      this.drawRulerBadge(
        canvas,
        font,
        Math.round((sy1 - this.panY) / this.zoom).toString(),
        0,
        Math.max(R, sy1),
        'vertical'
      )
      this.drawRulerBadge(
        canvas,
        font,
        Math.round((sy2 - this.panY) / this.zoom).toString(),
        0,
        sy2,
        'vertical'
      )
    }
  }

  private drawRulerBadge(
    canvas: Canvas,
    font: InstanceType<CanvasKit['Font']>,
    label: string,
    x: number,
    y: number,
    axis: 'horizontal' | 'vertical'
  ): void {
    const R = RULER_SIZE
    const glyphIds = font.getGlyphIDs(label)
    const widths = font.getGlyphWidths(glyphIds)
    const textW = widths.reduce((s, w) => s + w, 0)
    const pad = RULER_BADGE_PADDING
    const h = RULER_BADGE_HEIGHT

    this.rulerBadgePaint.setColor(this.selColor())

    if (axis === 'horizontal') {
      const bx = x - (textW + pad * 2) / 2
      const by = (R - h) / 2
      canvas.drawRRect(
        this.ck.RRectXY(
          this.ck.LTRBRect(bx, by, bx + textW + pad * 2, by + h),
          RULER_BADGE_RADIUS,
          RULER_BADGE_RADIUS
        ),
        this.rulerBadgePaint
      )
      canvas.drawText(label, bx + pad, R * RULER_TEXT_BASELINE, this.rulerLabelPaint, font)
    } else {
      const bw = textW + pad * 2
      const bx = (R - h) / 2
      const by = y - bw / 2
      canvas.save()
      canvas.translate(bx + h / 2, by + bw / 2)
      canvas.rotate(-90, 0, 0)
      canvas.drawRRect(
        this.ck.RRectXY(
          this.ck.LTRBRect(-bw / 2, -h / 2, bw / 2, h / 2),
          RULER_BADGE_RADIUS,
          RULER_BADGE_RADIUS
        ),
        this.rulerBadgePaint
      )
      canvas.drawText(label, -bw / 2 + pad, h / 2 - 3, this.rulerLabelPaint, font)
      canvas.restore()
    }
  }

  private rulerStep(): number {
    const pixelsPerUnit = this.zoom
    const rawStep = RULER_TARGET_PIXEL_SPACING / pixelsPerUnit
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const normalized = rawStep / magnitude

    if (normalized <= 1) return magnitude
    if (normalized <= 2) return 2 * magnitude
    if (normalized <= 5) return 5 * magnitude
    return 10 * magnitude
  }

  private rulerLabel(value: number): string {
    return Math.round(value).toString()
  }

  destroy(): void {
    for (const img of this.imageCache.values()) img.delete()
    this.imageCache.clear()
    for (const p of this.vectorPathCache.values()) p.delete()
    this.vectorPathCache.clear()
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
    this.penHandlePaint.delete()
    this.penVertexFill.delete()
    this.penVertexStroke.delete()
    this.effectLayerPaint.delete()
    for (const filter of this.imageFilterCache.values()) filter.delete()
    this.imageFilterCache.clear()
    for (const filter of this.maskFilterCache.values()) filter.delete()
    this.maskFilterCache.clear()
    for (const pic of this.nodePictureCache.values()) pic.delete()
    this.nodePictureCache.clear()
    this.scenePicture?.delete()
    this.surface.delete()
  }
}
