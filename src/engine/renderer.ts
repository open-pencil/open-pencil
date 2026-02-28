import {
  SELECTION_COLOR, SNAP_COLOR, CANVAS_BG_COLOR, ROTATION_HANDLE_OFFSET,
  RULER_SIZE, RULER_BG_COLOR, RULER_TICK_COLOR, RULER_TEXT_COLOR,
  RULER_BADGE_HEIGHT, RULER_BADGE_PADDING, RULER_BADGE_RADIUS, RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE, RULER_MAJOR_TICK, RULER_MINOR_TICK, RULER_HIGHLIGHT_ALPHA,
  PEN_HANDLE_RADIUS, PEN_VERTEX_RADIUS, PEN_CLOSE_RADIUS_BOOST, PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA, PARENT_OUTLINE_DASH,
  DEFAULT_FONT_SIZE, LABEL_FONT_SIZE, SIZE_FONT_SIZE,
  ROTATION_HANDLE_RADIUS, HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y, SIZE_PILL_PADDING_X, SIZE_PILL_PADDING_Y, SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS, SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA, SELECTION_DASH_ALPHA, DROP_HIGHLIGHT_ALPHA, DROP_HIGHLIGHT_STROKE,
  LAYOUT_INDICATOR_STROKE,
  RULER_TARGET_PIXEL_SPACING, RULER_MAJOR_TOLERANCE
} from '../constants'
import type { SceneNode, SceneGraph, Fill } from './scene-graph'
import type { SnapGuide } from './snap'
import { vectorNetworkToPath } from './vector'
import type {
  CanvasKit,
  Surface,
  Canvas,
  Paint,
  Font,
  FontMgr,
  FontWeight,
  TypefaceFontProvider
} from 'canvaskit-wasm'

export interface RenderOverlays {
  editingTextId?: string | null
  marquee?: { x: number; y: number; width: number; height: number } | null
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
    segments: Array<{ start: number; end: number; tangentStart: { x: number; y: number }; tangentEnd: { x: number; y: number } }>
    dragTangent: { x: number; y: number } | null
    closingToFirst: boolean
    cursorX?: number
    cursorY?: number
  } | null
}

export class SkiaRenderer {
  private ck: CanvasKit
  private surface: Surface
  private fillPaint: Paint
  private strokePaint: Paint
  private selectionPaint: Paint
  private parentOutlinePaint: Paint
  private snapPaint: Paint
  private textFont: Font | null = null
  private labelFont: Font | null = null
  private sizeFont: Font | null = null
  private fontMgr: FontMgr | null = null
  private fontProvider: TypefaceFontProvider | null = null
  private fontsLoaded = false

  panX = 0
  panY = 0
  zoom = 1
  dpr = 1
  viewportWidth = 0
  viewportHeight = 0
  showRulers = true
  pageColor = CANVAS_BG_COLOR

  private selColor(alpha = 1) {
    return this.ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, alpha)
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
    this.parentOutlinePaint.setPathEffect(ck.PathEffect.MakeDash([PARENT_OUTLINE_DASH, PARENT_OUTLINE_DASH], 0))

    this.snapPaint = new ck.Paint()
    this.snapPaint.setStyle(ck.PaintStyle.Stroke)
    this.snapPaint.setStrokeWidth(1)
    this.snapPaint.setColor(this.ck.Color4f(SNAP_COLOR.r, SNAP_COLOR.g, SNAP_COLOR.b, 1))
    this.snapPaint.setAntiAlias(true)

    this.textFont = new ck.Font(null, DEFAULT_FONT_SIZE)
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
        this.textFont = new this.ck.Font(typeface, DEFAULT_FONT_SIZE)
        this.labelFont = new this.ck.Font(typeface, LABEL_FONT_SIZE)
        this.sizeFont = new this.ck.Font(typeface, SIZE_FONT_SIZE)
      }
      this.fontMgr = this.ck.FontMgr.FromData(fontData) ?? null
    }

    this.fontsLoaded = true
  }

  render(graph: SceneGraph, selectedIds: Set<string>, overlays: RenderOverlays = {}): void {
    const canvas = this.surface.getCanvas()
    canvas.clear(this.ck.Color4f(this.pageColor.r, this.pageColor.g, this.pageColor.b, 1))

    // Scene layer (world coordinates)
    canvas.save()
    canvas.scale(this.dpr, this.dpr)
    canvas.translate(this.panX, this.panY)
    canvas.scale(this.zoom, this.zoom)

    const root = graph.getNode(graph.rootId)
    if (root) {
      for (const childId of root.childIds) {
        this.renderNode(canvas, graph, childId, overlays)
      }
    }

    canvas.restore()

    // UI overlay layer (screen coordinates, zoom-independent)
    canvas.save()
    canvas.scale(this.dpr, this.dpr)

    this.drawSelection(canvas, graph, selectedIds, overlays)
    this.drawSnapGuides(canvas, overlays.snapGuides)
    this.drawMarquee(canvas, overlays.marquee)
    this.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
    this.drawPenOverlay(canvas, overlays.penState)
    if (this.showRulers) this.drawRulers(canvas, graph, selectedIds)

    canvas.restore()
    this.surface.flush()
  }

  // --- Selection UI ---

  private drawSelection(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>,
    overlays: RenderOverlays
  ): void {
    if (selectedIds.size === 0) return

    this.selectionPaint.setStrokeWidth(1)

    this.drawParentFrameOutlines(canvas, graph, selectedIds)

    if (selectedIds.size === 1) {
      const id = [...selectedIds][0]
      if (overlays.editingTextId === id) return
      const node = graph.getNode(id)
      if (!node) return

      const rotation =
        overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
      this.drawNodeSelection(canvas, node, rotation, graph)
      this.drawSelectionLabels(canvas, graph, selectedIds)
      return
    }

    for (const id of selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      const rotation =
        overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
      this.drawNodeOutline(canvas, node, rotation, graph)
    }

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
    const rotLinePaint = new this.ck.Paint()
    rotLinePaint.setStyle(this.ck.PaintStyle.Stroke)
    rotLinePaint.setStrokeWidth(1)
    rotLinePaint.setColor(this.selColor())
    rotLinePaint.setAntiAlias(true)
    canvas.drawLine(mx, y1, mx, rotHandleY, rotLinePaint)

    const rotFill = new this.ck.Paint()
    rotFill.setStyle(this.ck.PaintStyle.Fill)
    rotFill.setColor(this.ck.WHITE)
    rotFill.setAntiAlias(true)
    canvas.drawCircle(mx, rotHandleY, ROTATION_HANDLE_RADIUS, rotFill)
    canvas.drawCircle(mx, rotHandleY, ROTATION_HANDLE_RADIUS, rotLinePaint)
    rotLinePaint.delete()
    rotFill.delete()

    canvas.restore()
  }

  private drawSelectionLabels(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>
  ): void {
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

    // Frame name label — only for top-level frames (direct children of root)
    if (nodes.length === 1) {
      const node = nodes[0]
      if (node.type === 'FRAME' && node.parentId === graph.rootId) {
        const labelPaint = new this.ck.Paint()
        labelPaint.setStyle(this.ck.PaintStyle.Fill)
        labelPaint.setColor(this.selColor())
        labelPaint.setAntiAlias(true)
        canvas.drawText(node.name, sx1, sy1 - LABEL_OFFSET_Y, labelPaint, this.labelFont)
        labelPaint.delete()
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

    const pillPaint = new this.ck.Paint()
    pillPaint.setStyle(this.ck.PaintStyle.Fill)
    pillPaint.setColor(this.selColor())
    pillPaint.setAntiAlias(true)

    const rrect = this.ck.RRectXY(this.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH), SIZE_PILL_RADIUS, SIZE_PILL_RADIUS)
    canvas.drawRRect(rrect, pillPaint)

    const textPaint = new this.ck.Paint()
    textPaint.setStyle(this.ck.PaintStyle.Fill)
    textPaint.setColor(this.ck.WHITE)
    textPaint.setAntiAlias(true)
    canvas.drawText(sizeText, pillX + SIZE_PILL_PADDING_X, pillY + SIZE_PILL_TEXT_OFFSET_Y, textPaint, this.sizeFont)

    pillPaint.delete()
    textPaint.delete()
  }

  private drawParentFrameOutlines(
    canvas: Canvas,
    graph: SceneGraph,
    selectedIds: Set<string>
  ): void {
    const drawn = new Set<string>()
    for (const id of selectedIds) {
      const node = graph.getNode(id)
      if (!node?.parentId || node.parentId === graph.rootId) continue
      if (drawn.has(node.parentId) || selectedIds.has(node.parentId)) continue

      const parent = graph.getNode(node.parentId)
      if (!parent) continue

      // Skip dashed outline for top-level frames (direct children of root)
      if (parent.parentId === graph.rootId) continue

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
    const dashPaint = new this.ck.Paint()
    dashPaint.setStyle(this.ck.PaintStyle.Stroke)
    dashPaint.setStrokeWidth(1)
    dashPaint.setColor(this.selColor(SELECTION_DASH_ALPHA))
    dashPaint.setAntiAlias(true)

    canvas.drawRect(this.ck.LTRBRect(minX, minY, maxX, maxY), dashPaint)

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

    dashPaint.delete()
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
    const handleFill = new this.ck.Paint()
    handleFill.setStyle(this.ck.PaintStyle.Fill)
    handleFill.setColor(this.ck.WHITE)

    const rect = this.ck.LTRBRect(x - HANDLE_HALF_SIZE, y - HANDLE_HALF_SIZE, x + HANDLE_HALF_SIZE, y + HANDLE_HALF_SIZE)
    canvas.drawRect(rect, handleFill)
    canvas.drawRect(rect, this.selectionPaint)
    handleFill.delete()
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

  private drawMarquee(
    canvas: Canvas,
    marquee?: { x: number; y: number; width: number; height: number } | null
  ): void {
    if (!marquee || marquee.width <= 0 || marquee.height <= 0) return

    const x1 = marquee.x * this.zoom + this.panX
    const y1 = marquee.y * this.zoom + this.panY
    const x2 = (marquee.x + marquee.width) * this.zoom + this.panX
    const y2 = (marquee.y + marquee.height) * this.zoom + this.panY
    const rect = this.ck.LTRBRect(x1, y1, x2, y2)

    const fill = new this.ck.Paint()
    fill.setStyle(this.ck.PaintStyle.Fill)
    fill.setColor(this.selColor(MARQUEE_FILL_ALPHA))
    canvas.drawRect(rect, fill)
    canvas.drawRect(rect, this.selectionPaint)
    fill.delete()
  }

  // --- Layout insert indicator ---

  private drawLayoutInsertIndicator(
    canvas: Canvas,
    indicator?: RenderOverlays['layoutInsertIndicator']
  ): void {
    if (!indicator) return

    const paint = new this.ck.Paint()
    paint.setStyle(this.ck.PaintStyle.Stroke)
    paint.setStrokeWidth(LAYOUT_INDICATOR_STROKE)
    paint.setColor(this.selColor())
    paint.setAntiAlias(true)

    if (indicator.direction === 'HORIZONTAL') {
      const y = indicator.y * this.zoom + this.panY
      const x1 = indicator.x * this.zoom + this.panX
      const x2 = (indicator.x + indicator.length) * this.zoom + this.panX
      canvas.drawLine(x1, y, x2, y, paint)
    } else {
      const x = indicator.x * this.zoom + this.panX
      const y1 = indicator.y * this.zoom + this.panY
      const y2 = (indicator.y + indicator.length) * this.zoom + this.panY
      canvas.drawLine(x, y1, x, y2, paint)
    }

    paint.delete()
  }

  // --- Scene rendering ---

  private renderNode(
    canvas: Canvas,
    graph: SceneGraph,
    nodeId: string,
    overlays: RenderOverlays
  ): void {
    const node = graph.getNode(nodeId)
    if (!node || !node.visible) return

    canvas.save()
    canvas.translate(node.x, node.y)

    if (node.opacity < 1) {
      const layerPaint = new this.ck.Paint()
      layerPaint.setAlphaf(node.opacity)
      canvas.saveLayer(layerPaint)
      layerPaint.delete()
    }

    const rotation =
      overlays.rotationPreview?.nodeId === nodeId ? overlays.rotationPreview.angle : node.rotation

    if (rotation !== 0) {
      canvas.rotate(rotation, node.width / 2, node.height / 2)
    }

    if (overlays.editingTextId !== nodeId) {
      this.renderShape(canvas, node)
    }

    // Drop target highlight
    if (overlays.dropTargetId === nodeId) {
      const highlight = new this.ck.Paint()
      highlight.setStyle(this.ck.PaintStyle.Stroke)
      highlight.setStrokeWidth(DROP_HIGHLIGHT_STROKE / this.zoom)
      highlight.setColor(this.selColor(DROP_HIGHLIGHT_ALPHA))
      highlight.setAntiAlias(true)
      canvas.drawRect(this.ck.LTRBRect(0, 0, node.width, node.height), highlight)
      highlight.delete()
    }

    // Clip + render children for containers
    if (node.type === 'FRAME' && node.clipsContent && node.childIds.length > 0) {
      canvas.save()
      canvas.clipRect(
        this.ck.LTRBRect(0, 0, node.width, node.height),
        this.ck.ClipOp.Intersect,
        true
      )
      for (const childId of node.childIds) {
        this.renderNode(canvas, graph, childId, overlays)
      }
      canvas.restore()
    } else {
      for (const childId of node.childIds) {
        this.renderNode(canvas, graph, childId, overlays)
      }
    }

    if (node.opacity < 1) {
      canvas.restore()
    }
    canvas.restore()
  }

  private renderShape(canvas: Canvas, node: SceneNode): void {
    const rect = this.ck.LTRBRect(0, 0, node.width, node.height)

    const hasRadius =
      node.cornerRadius > 0 ||
      (node.independentCorners &&
        (node.topLeftRadius > 0 ||
          node.topRightRadius > 0 ||
          node.bottomRightRadius > 0 ||
          node.bottomLeftRadius > 0))

    // Fills
    for (const fill of node.fills) {
      if (!fill.visible) continue
      this.applyFill(fill)
      this.fillPaint.setAlphaf(fill.opacity)

      switch (node.type) {
        case 'VECTOR':
          if (node.vectorNetwork) {
            const vp = vectorNetworkToPath(this.ck, node.vectorNetwork)
            canvas.drawPath(vp, this.fillPaint)
            vp.delete()
          }
          break
        case 'ELLIPSE':
          canvas.drawOval(rect, this.fillPaint)
          break
        case 'TEXT':
          this.renderText(canvas, node)
          break
        case 'LINE':
          canvas.drawLine(0, 0, node.width, node.height, this.fillPaint)
          break
        default:
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
              canvas.drawRRect(rrect, this.fillPaint)
            } else {
              const rrect = this.ck.RRectXY(rect, node.cornerRadius, node.cornerRadius)
              canvas.drawRRect(rrect, this.fillPaint)
            }
          } else {
            canvas.drawRect(rect, this.fillPaint)
          }
      }
    }

    // Strokes
    for (const stroke of node.strokes) {
      if (!stroke.visible) continue
      this.strokePaint.setColor(
        this.ck.Color4f(stroke.color.r, stroke.color.g, stroke.color.b, stroke.color.a)
      )
      this.strokePaint.setStrokeWidth(stroke.weight)
      this.strokePaint.setAlphaf(stroke.opacity)

      switch (node.type) {
        case 'VECTOR':
          if (node.vectorNetwork) {
            const vp = vectorNetworkToPath(this.ck, node.vectorNetwork)
            canvas.drawPath(vp, this.strokePaint)
            vp.delete()
          }
          break
        case 'ELLIPSE':
          canvas.drawOval(rect, this.strokePaint)
          break
        default:
          if (hasRadius && !node.independentCorners) {
            const rrect = this.ck.RRectXY(rect, node.cornerRadius, node.cornerRadius)
            canvas.drawRRect(rrect, this.strokePaint)
          } else {
            canvas.drawRect(rect, this.strokePaint)
          }
      }
    }
  }

  private renderText(canvas: Canvas, node: SceneNode): void {
    const text = node.text
    if (!text) return

    if (this.fontsLoaded && this.fontProvider) {
      const paraStyle = new this.ck.ParagraphStyle({
        textAlign: this.getTextAlign(node.textAlignHorizontal),
        textStyle: {
          color: this.fillPaint.getColor(),
          fontFamilies: [node.fontFamily || 'Inter'],
          fontSize: node.fontSize || DEFAULT_FONT_SIZE,
          fontStyle: { weight: { value: node.fontWeight || 400 } as FontWeight },
          letterSpacing: node.letterSpacing || 0,
          heightMultiplier: node.lineHeight ? node.lineHeight / (node.fontSize || DEFAULT_FONT_SIZE) : undefined
        }
      })
      const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, this.fontProvider)
      builder.addText(text)
      const paragraph = builder.build()
      paragraph.layout(node.width || 1e6)
      canvas.drawParagraph(paragraph, 0, 0)
      paragraph.delete()
      builder.delete()
    } else if (this.textFont) {
      canvas.drawText(text, 0, node.fontSize || DEFAULT_FONT_SIZE, this.fillPaint, this.textFont)
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

  private applyFill(fill: Fill): void {
    if (fill.type === 'SOLID') {
      this.fillPaint.setColor(
        this.ck.Color4f(fill.color.r, fill.color.g, fill.color.b, fill.color.a)
      )
    }
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
    const pathPaint = new this.ck.Paint()
    pathPaint.setStyle(this.ck.PaintStyle.Stroke)
    pathPaint.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
    pathPaint.setColor(this.selColor())
    pathPaint.setAntiAlias(true)

    const handlePaint = new this.ck.Paint()
    handlePaint.setStyle(this.ck.PaintStyle.Stroke)
    handlePaint.setStrokeWidth(1)
    handlePaint.setColor(this.selColor(PARENT_OUTLINE_ALPHA))
    handlePaint.setAntiAlias(true)

    const vertexFill = new this.ck.Paint()
    vertexFill.setStyle(this.ck.PaintStyle.Fill)
    vertexFill.setColor(this.ck.WHITE)
    vertexFill.setAntiAlias(true)

    const vertexStroke = new this.ck.Paint()
    vertexStroke.setStyle(this.ck.PaintStyle.Stroke)
    vertexStroke.setStrokeWidth(PEN_PATH_STROKE_WIDTH)
    vertexStroke.setColor(this.selColor())
    vertexStroke.setAntiAlias(true)

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
        seg.tangentStart.x === 0 && seg.tangentStart.y === 0 &&
        seg.tangentEnd.x === 0 && seg.tangentEnd.y === 0
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
      const radius = i === 0 && penState.closingToFirst ? PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST : PEN_VERTEX_RADIUS
      canvas.drawCircle(v.x, v.y, radius, vertexFill)
      canvas.drawCircle(v.x, v.y, radius, vertexStroke)
    }

    pathPaint.delete()
    handlePaint.delete()
    vertexFill.delete()
    vertexStroke.delete()
  }

  // --- Rulers ---



  private drawRulers(canvas: Canvas, graph: SceneGraph, selectedIds: Set<string>): void {
    const R = RULER_SIZE
    const vw = this.viewportWidth
    const vh = this.viewportHeight
    if (vw === 0 || vh === 0) return

    const bg = RULER_BG_COLOR
    const bgPaint = new this.ck.Paint()
    bgPaint.setColor(this.ck.Color4f(bg.r, bg.g, bg.b, 1))

    canvas.drawRect(this.ck.LTRBRect(0, 0, vw, R), bgPaint)
    canvas.drawRect(this.ck.LTRBRect(0, R, R, vh), bgPaint)

    // Corner square
    canvas.drawRect(this.ck.LTRBRect(0, 0, R, R), bgPaint)

    const tickPaint = new this.ck.Paint()
    tickPaint.setColor(this.ck.Color4f(RULER_TICK_COLOR.r, RULER_TICK_COLOR.g, RULER_TICK_COLOR.b, 1))
    tickPaint.setStrokeWidth(1)
    tickPaint.setAntiAlias(true)

    const textColor = RULER_TEXT_COLOR
    const textPaint = new this.ck.Paint()
    textPaint.setColor(this.ck.Color4f(textColor.r, textColor.g, textColor.b, 1))
    textPaint.setAntiAlias(true)

    const font = this.sizeFont ?? this.textFont
    if (!font) { bgPaint.delete(); tickPaint.delete(); textPaint.delete(); return }

    const step = this.rulerStep()
    const minorStep = step / 5

    // Compute selection bounds for badge exclusion zones
    let sx1 = -Infinity, sx2 = -Infinity, sy1 = -Infinity, sy2 = -Infinity
    const selNodes = [...selectedIds]
      .map((id) => graph.getNode(id))
      .filter((n): n is SceneNode => n !== undefined)
    if (selNodes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
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
      const hlPaint = new this.ck.Paint()
      hlPaint.setColor(this.selColor(RULER_HIGHLIGHT_ALPHA))

      canvas.drawRect(this.ck.LTRBRect(Math.max(R, sx1), 0, sx2, R), hlPaint)
      canvas.drawRect(this.ck.LTRBRect(0, Math.max(R, sy1), R, sy2), hlPaint)

      this.drawRulerBadge(canvas, font, Math.round((sx1 - this.panX) / this.zoom).toString(), Math.max(R, sx1), 0, 'horizontal')
      this.drawRulerBadge(canvas, font, Math.round((sx2 - this.panX) / this.zoom).toString(), sx2, 0, 'horizontal')
      this.drawRulerBadge(canvas, font, Math.round((sy1 - this.panY) / this.zoom).toString(), 0, Math.max(R, sy1), 'vertical')
      this.drawRulerBadge(canvas, font, Math.round((sy2 - this.panY) / this.zoom).toString(), 0, sy2, 'vertical')

      hlPaint.delete()
    }

    bgPaint.delete()
    tickPaint.delete()
    textPaint.delete()
  }

  private drawRulerBadge(canvas: Canvas, font: InstanceType<CanvasKit['Font']>, label: string, x: number, y: number, axis: 'horizontal' | 'vertical'): void {
    const R = RULER_SIZE
    const glyphIds = font.getGlyphIDs(label)
    const widths = font.getGlyphWidths(glyphIds)
    const textW = widths.reduce((s, w) => s + w, 0)
    const pad = RULER_BADGE_PADDING
    const h = RULER_BADGE_HEIGHT

    const badgePaint = new this.ck.Paint()
    badgePaint.setColor(this.selColor())
    const labelPaint = new this.ck.Paint()
    labelPaint.setColor(this.ck.Color4f(1, 1, 1, 1))
    labelPaint.setAntiAlias(true)

    if (axis === 'horizontal') {
      const bx = x - (textW + pad * 2) / 2
      const by = (R - h) / 2
      canvas.drawRRect(this.ck.RRectXY(this.ck.LTRBRect(bx, by, bx + textW + pad * 2, by + h), RULER_BADGE_RADIUS, RULER_BADGE_RADIUS), badgePaint)
      canvas.drawText(label, bx + pad, R * RULER_TEXT_BASELINE, labelPaint, font)
    } else {
      const bw = textW + pad * 2
      const bx = (R - h) / 2
      const by = y - (bw) / 2
      canvas.save()
      canvas.translate(bx + h / 2, by + bw / 2)
      canvas.rotate(-90, 0, 0)
      canvas.drawRRect(this.ck.RRectXY(this.ck.LTRBRect(-bw / 2, -h / 2, bw / 2, h / 2), RULER_BADGE_RADIUS, RULER_BADGE_RADIUS), badgePaint)
      canvas.drawText(label, -bw / 2 + pad, h / 2 - 3, labelPaint, font)
      canvas.restore()
    }

    badgePaint.delete()
    labelPaint.delete()
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
    this.fillPaint.delete()
    this.strokePaint.delete()
    this.selectionPaint.delete()
    this.snapPaint.delete()
    this.textFont?.delete()
    this.labelFont?.delete()
    this.sizeFont?.delete()
    this.fontMgr?.delete()
    this.fontProvider?.delete()
    this.surface.delete()
  }
}
