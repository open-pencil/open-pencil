import {
  HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA,
  SELECTION_DASH_ALPHA,
  LAYOUT_INDICATOR_STROKE,

  TEXT_SELECTION_COLOR,
  TEXT_CARET_COLOR,
  TEXT_CARET_WIDTH,
  FLASH_COLOR,
  FLASH_ATTACK_MS,
  FLASH_HOLD_MS,
  FLASH_RELEASE_MS,
  FLASH_STROKE_WIDTH,
  FLASH_PADDING,
  FLASH_OVERSHOOT,
  FLASH_RADIUS
} from '../constants'
import type { SceneNode, SceneGraph } from '../scene-graph'
import type { SnapGuide } from '../snap'
import type { TextEditor } from '../text-editor'
import type { Rect, Vector } from '../types'
import type { Canvas } from 'canvaskit-wasm'
import type { SkiaRenderer, RenderOverlays } from './renderer'

export function drawHoverHighlight(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hoveredNodeId?: string | null
): void {
  if (!hoveredNodeId) return
  const node = graph.getNode(hoveredNodeId)
  if (!node) return

  const abs = graph.getAbsolutePosition(node.id)
  const sx = abs.x * r.zoom + r.panX
  const sy = abs.y * r.zoom + r.panY

  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(
    r.isComponentType(node.type) ? r.compColor() : r.selColor()
  )
  r.auxStroke.setPathEffect(null)

  canvas.save()
  canvas.translate(sx, sy)
  if (node.rotation !== 0) {
    const cx = (node.width / 2) * r.zoom
    const cy = (node.height / 2) * r.zoom
    canvas.rotate(node.rotation, cx, cy)
  }
  canvas.scale(r.zoom, r.zoom)
  r.strokeNodeShape(canvas, node, r.auxStroke)
  canvas.restore()
}

export function drawSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  if (selectedIds.size === 0) return

  r.drawParentFrameOutlines(canvas, graph, selectedIds)

  if (selectedIds.size === 1) {
    const id = [...selectedIds][0]
    if (overlays.editingTextId === id) return
    const node = graph.getNode(id)
    if (!node) return

    const useComponentColor = r.isComponentType(node.type)
    r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
    r.selectionPaint.setStrokeWidth(1)

    const rotation =
      overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
    r.drawNodeSelection(canvas, node, rotation, graph)
    r.drawSelectionLabels(canvas, graph, selectedIds)

    r.selectionPaint.setColor(r.selColor())
    return
  }

  for (const id of selectedIds) {
    const node = graph.getNode(id)
    if (!node) continue

    const useComponentColor = r.isComponentType(node.type)
    r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
    r.selectionPaint.setStrokeWidth(1)

    const rotation =
      overlays.rotationPreview?.nodeId === id ? overlays.rotationPreview.angle : node.rotation
    r.drawNodeOutline(canvas, node, rotation, graph)
  }

  r.selectionPaint.setColor(r.selColor())

  const nodes = [...selectedIds]
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  r.drawGroupBounds(canvas, nodes, graph)

  r.drawSelectionLabels(canvas, graph, selectedIds)
}

export function drawNodeSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph
): void {
  const abs = graph.getAbsolutePosition(node.id)
  const cx = (abs.x + node.width / 2) * r.zoom + r.panX
  const cy = (abs.y + node.height / 2) * r.zoom + r.panY
  const hw = (node.width / 2) * r.zoom
  const hh = (node.height / 2) * r.zoom

  canvas.save()
  if (rotation !== 0) {
    canvas.rotate(rotation, cx, cy)
  }

  const x1 = cx - hw
  const y1 = cy - hh
  const x2 = cx + hw
  const y2 = cy + hh

  canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)

  r.drawHandle(canvas, x1, y1)
  r.drawHandle(canvas, x2, y1)
  r.drawHandle(canvas, x1, y2)
  r.drawHandle(canvas, x2, y2)

  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  r.drawHandle(canvas, mx, y1)
  r.drawHandle(canvas, mx, y2)
  r.drawHandle(canvas, x1, my)
  r.drawHandle(canvas, x2, my)

  canvas.restore()
}

export function drawSelectionLabels(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>
): void {
  if (!r.labelFont || !r.sizeFont) return

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

  const sx1 = minX * r.zoom + r.panX
  const sy1 = minY * r.zoom + r.panY
  const sx2 = maxX * r.zoom + r.panX
  const sy2 = maxY * r.zoom + r.panY
  const smx = (sx1 + sx2) / 2

  if (nodes.length === 1) {
    const node = nodes[0]
    const parentNode = node.parentId ? graph.getNode(node.parentId) : null
    const isTopLevel =
      !parentNode || parentNode.type === 'CANVAS' || parentNode.type === 'SECTION'
    if (node.type === 'FRAME' && isTopLevel) {
      r.auxFill.setColor(r.selColor())
      canvas.drawText(node.name, sx1, sy1 - LABEL_OFFSET_Y, r.auxFill, r.labelFont)
    }
  }

  const w = Math.round(maxX - minX)
  const h = Math.round(maxY - minY)
  const sizeText = `${w} × ${h}`
  const glyphIds = r.sizeFont.getGlyphIDs(sizeText)
  const widths = r.sizeFont.getGlyphWidths(glyphIds)
  let textWidth = 0
  for (const w of widths) textWidth += w
  const pillW = textWidth + SIZE_PILL_PADDING_X * 2
  const pillH = SIZE_PILL_HEIGHT
  const pillX = smx - pillW / 2
  const pillY = sy2 + SIZE_PILL_PADDING_Y

  const allComponents = nodes.length > 0 && nodes.every((n) => r.isComponentType(n.type))
  const pillColor = allComponents ? r.compColor() : r.selColor()

  r.auxFill.setColor(pillColor)
  const rrect = r.ck.RRectXY(
    r.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH),
    SIZE_PILL_RADIUS,
    SIZE_PILL_RADIUS
  )
  canvas.drawRRect(rrect, r.auxFill)

  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawText(
    sizeText,
    pillX + SIZE_PILL_PADDING_X,
    pillY + SIZE_PILL_TEXT_OFFSET_Y,
    r.auxFill,
    r.sizeFont
  )
}

export function drawParentFrameOutlines(
  r: SkiaRenderer,
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

    const grandparent = parent.parentId ? graph.getNode(parent.parentId) : null
    if (!grandparent || grandparent.type === 'CANVAS') continue

    drawn.add(node.parentId)

    const abs = graph.getAbsolutePosition(parent.id)
    const x = abs.x * r.zoom + r.panX
    const y = abs.y * r.zoom + r.panY
    const w = parent.width * r.zoom
    const h = parent.height * r.zoom

    canvas.save()
    if (parent.rotation !== 0) {
      canvas.rotate(parent.rotation, x + w / 2, y + h / 2)
    }
    canvas.drawRect(r.ck.LTRBRect(x, y, x + w, y + h), r.parentOutlinePaint)
    canvas.restore()
  }
}

export function drawNodeOutline(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph
): void {
  const abs = graph.getAbsolutePosition(node.id)
  const cx = (abs.x + node.width / 2) * r.zoom + r.panX
  const cy = (abs.y + node.height / 2) * r.zoom + r.panY
  const hw = (node.width / 2) * r.zoom
  const hh = (node.height / 2) * r.zoom

  canvas.save()
  if (rotation !== 0) {
    canvas.rotate(rotation, cx, cy)
  }

  canvas.drawRect(r.ck.LTRBRect(cx - hw, cy - hh, cx + hw, cy + hh), r.selectionPaint)
  canvas.restore()
}

export function drawGroupBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  nodes: SceneNode[],
  graph: SceneGraph
): void {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const abs = graph.getAbsolutePosition(n.id)
    if (n.rotation !== 0) {
      const corners = r.getRotatedCorners(n, abs)
      for (const c of corners) {
        minX = Math.min(minX, c.x)
        minY = Math.min(minY, c.y)
        maxX = Math.max(maxX, c.x)
        maxY = Math.max(maxY, c.y)
      }
    } else {
      const x1 = abs.x * r.zoom + r.panX
      const y1 = abs.y * r.zoom + r.panY
      const x2 = (abs.x + n.width) * r.zoom + r.panX
      const y2 = (abs.y + n.height) * r.zoom + r.panY
      minX = Math.min(minX, x1)
      minY = Math.min(minY, y1)
      maxX = Math.max(maxX, x2)
      maxY = Math.max(maxY, y2)
    }
  }

  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
  r.auxStroke.setPathEffect(null)

  canvas.drawRect(r.ck.LTRBRect(minX, minY, maxX, maxY), r.auxStroke)

  r.drawHandle(canvas, minX, minY)
  r.drawHandle(canvas, maxX, minY)
  r.drawHandle(canvas, minX, maxY)
  r.drawHandle(canvas, maxX, maxY)
  const gmx = (minX + maxX) / 2
  const gmy = (minY + maxY) / 2
  r.drawHandle(canvas, gmx, minY)
  r.drawHandle(canvas, gmx, maxY)
  r.drawHandle(canvas, minX, gmy)
  r.drawHandle(canvas, maxX, gmy)
}

export function getRotatedCorners(
  r: SkiaRenderer,
  n: SceneNode,
  abs: Vector
): Vector[] {
  const cx = (abs.x + n.width / 2) * r.zoom + r.panX
  const cy = (abs.y + n.height / 2) * r.zoom + r.panY
  const hw = (n.width / 2) * r.zoom
  const hh = (n.height / 2) * r.zoom
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

export function drawHandle(r: SkiaRenderer, canvas: Canvas, x: number, y: number): void {
  r.auxFill.setColor(r.ck.WHITE)
  const rect = r.ck.LTRBRect(
    x - HANDLE_HALF_SIZE,
    y - HANDLE_HALF_SIZE,
    x + HANDLE_HALF_SIZE,
    y + HANDLE_HALF_SIZE
  )
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}

export function drawSnapGuides(
  r: SkiaRenderer,
  canvas: Canvas,
  guides?: SnapGuide[]
): void {
  if (!guides || guides.length === 0) return

  for (const guide of guides) {
    if (guide.axis === 'x') {
      const x = guide.position * r.zoom + r.panX
      const y1 = guide.from * r.zoom + r.panY
      const y2 = guide.to * r.zoom + r.panY
      canvas.drawLine(x, y1, x, y2, r.snapPaint)
    } else {
      const y = guide.position * r.zoom + r.panY
      const x1 = guide.from * r.zoom + r.panX
      const x2 = guide.to * r.zoom + r.panX
      canvas.drawLine(x1, y, x2, y, r.snapPaint)
    }
  }
}

export function drawMarquee(r: SkiaRenderer, canvas: Canvas, marquee?: Rect | null): void {
  if (!marquee || marquee.width <= 0 || marquee.height <= 0) return

  const x1 = marquee.x * r.zoom + r.panX
  const y1 = marquee.y * r.zoom + r.panY
  const x2 = (marquee.x + marquee.width) * r.zoom + r.panX
  const y2 = (marquee.y + marquee.height) * r.zoom + r.panY
  const rect = r.ck.LTRBRect(x1, y1, x2, y2)

  r.auxFill.setColor(r.selColor(MARQUEE_FILL_ALPHA))
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}

export function drawFlashes(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (r._flashes.length === 0) return

  const now = performance.now()
  const ck = r.ck
  const totalMs = FLASH_ATTACK_MS + FLASH_HOLD_MS + FLASH_RELEASE_MS

  if (!r._flashPaint) {
    r._flashPaint = new ck.Paint()
    r._flashPaint.setStyle(ck.PaintStyle.Stroke)
    r._flashPaint.setAntiAlias(true)
  }

  const paint = r._flashPaint
  const zoom = r.zoom

  for (let i = r._flashes.length - 1; i >= 0; i--) {
    const flash = r._flashes[i]
    const elapsed = now - flash.startTime
    if (elapsed > totalMs) {
      r._flashes.splice(i, 1)
      continue
    }

    const node = graph.getNode(flash.nodeId)
    if (!node) {
      r._flashes.splice(i, 1)
      continue
    }

    const abs = graph.getAbsolutePosition(flash.nodeId)
    const cx = (abs.x + node.width / 2) * zoom + r.panX
    const cy = (abs.y + node.height / 2) * zoom + r.panY
    const hw = (node.width / 2) * zoom
    const hh = (node.height / 2) * zoom

    let opacity: number
    let extraPad: number

    if (elapsed < FLASH_ATTACK_MS) {
      const t = elapsed / FLASH_ATTACK_MS
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      opacity = ease
      extraPad = (1 - ease) * FLASH_OVERSHOOT
    } else if (elapsed < FLASH_ATTACK_MS + FLASH_HOLD_MS) {
      opacity = 1
      extraPad = 0
    } else {
      const t = (elapsed - FLASH_ATTACK_MS - FLASH_HOLD_MS) / FLASH_RELEASE_MS
      opacity = 1 - t * t
      extraPad = 0
    }

    const pad = FLASH_PADDING + extraPad
    const rad = FLASH_RADIUS

    paint.setColor(ck.Color4f(FLASH_COLOR.r, FLASH_COLOR.g, FLASH_COLOR.b, opacity))
    paint.setStrokeWidth(FLASH_STROKE_WIDTH)

    canvas.save()
    if (node.rotation !== 0) canvas.rotate(node.rotation, cx, cy)

    const rect = ck.RRectXY(
      ck.LTRBRect(cx - hw - pad, cy - hh - pad, cx + hw + pad, cy + hh + pad),
      rad,
      rad
    )
    canvas.drawRRect(rect, paint)
    canvas.restore()
  }
}

export function drawLayoutInsertIndicator(
  r: SkiaRenderer,
  canvas: Canvas,
  indicator?: RenderOverlays['layoutInsertIndicator']
): void {
  if (!indicator) return

  r.auxStroke.setStrokeWidth(LAYOUT_INDICATOR_STROKE)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)

  if (indicator.direction === 'HORIZONTAL') {
    const y = indicator.y * r.zoom + r.panY
    const x1 = indicator.x * r.zoom + r.panX
    const x2 = (indicator.x + indicator.length) * r.zoom + r.panX
    canvas.drawLine(x1, y, x2, y, r.auxStroke)
  } else {
    const x = indicator.x * r.zoom + r.panX
    const y1 = indicator.y * r.zoom + r.panY
    const y2 = (indicator.y + indicator.length) * r.zoom + r.panY
    canvas.drawLine(x, y1, x, y2, r.auxStroke)
  }
}

export function drawTextEditOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  editor: TextEditor
): void {
  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxStroke)

  const selRects = editor.getSelectionRects()
  if (selRects.length > 0) {
    r.auxFill.setColor(
      r.ck.Color4f(
        TEXT_SELECTION_COLOR.r,
        TEXT_SELECTION_COLOR.g,
        TEXT_SELECTION_COLOR.b,
        TEXT_SELECTION_COLOR.a
      )
    )
    for (const sel of selRects) {
      canvas.drawRect(
        r.ck.LTRBRect(sel.x, sel.y, sel.x + sel.width, sel.y + sel.height),
        r.auxFill
      )
    }
  }

  if (editor.caretVisible && !editor.hasSelection()) {
    const caret = editor.getCaretRect()
    if (caret) {
      r.auxFill.setColor(
        r.ck.Color4f(
          TEXT_CARET_COLOR.r,
          TEXT_CARET_COLOR.g,
          TEXT_CARET_COLOR.b,
          TEXT_CARET_COLOR.a
        )
      )
      const w = TEXT_CARET_WIDTH / r.zoom
      canvas.drawRect(
        r.ck.LTRBRect(caret.x - w / 2, caret.y0, caret.x + w / 2, caret.y1),
        r.auxFill
      )
    }
  }
}

export { drawPenOverlay, drawRemoteCursors } from './pen-overlay'
