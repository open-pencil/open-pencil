import type { Canvas } from 'canvaskit-wasm'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import {
  AUTO_LAYOUT_HOVER_BLUE,
  AUTO_LAYOUT_HOVER_BLUE_FILL,
  AUTO_LAYOUT_HOVER_CHILD_DASH,
  AUTO_LAYOUT_HOVER_MAGENTA,
  AUTO_LAYOUT_HOVER_MAGENTA_FILL,
  AUTO_LAYOUT_HOVER_STRIPE_GAP,
  AUTO_LAYOUT_HOVER_STRIPE_WIDTH,
  AUTO_LAYOUT_HOVER_STROKE_WIDTH,
  AUTO_LAYOUT_HOVER_TICK_LENGTH,
  AUTO_LAYOUT_HOVER_VALUE_OFFSET,
  AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT,
  AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X,
  AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS
} from '#core/constants'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { Color } from '#core/types'

type Hover = NonNullable<RenderOverlays['autoLayoutHover']>
type RectTuple = [x: number, y: number, width: number, height: number]

function visibleLayoutChildren(node: SceneNode, graph: SceneGraph) {
  return node.childIds
    .map((id) => graph.getNode(id))
    .filter(
      (child): child is SceneNode =>
        !!child && child.visible && child.layoutPositioning !== 'ABSOLUTE'
    )
}

function canvasColor(r: SkiaRenderer, color: Color) {
  return r.ck.Color4f(color.r, color.g, color.b, color.a)
}

function setStroke(r: SkiaRenderer, color: Color) {
  r.auxStroke.setStrokeWidth(AUTO_LAYOUT_HOVER_STROKE_WIDTH)
  r.auxStroke.setColor(canvasColor(r, color))
  r.auxStroke.setPathEffect(null)
}

function drawHorizontalTick(r: SkiaRenderer, canvas: Canvas, x: number, y: number) {
  canvas.drawLine(
    x - AUTO_LAYOUT_HOVER_TICK_LENGTH,
    y,
    x + AUTO_LAYOUT_HOVER_TICK_LENGTH,
    y,
    r.auxStroke
  )
}

function drawVerticalTick(r: SkiaRenderer, canvas: Canvas, x: number, y: number) {
  canvas.drawLine(
    x,
    y - AUTO_LAYOUT_HOVER_TICK_LENGTH,
    x,
    y + AUTO_LAYOUT_HOVER_TICK_LENGTH,
    r.auxStroke
  )
}

function toScreenRect(r: SkiaRenderer, [x, y, width, height]: RectTuple) {
  return r.ck.LTRBRect(
    x * r.zoom + r.panX,
    y * r.zoom + r.panY,
    (x + width) * r.zoom + r.panX,
    (y + height) * r.zoom + r.panY
  )
}

function drawStripedRect(r: SkiaRenderer, canvas: Canvas, rectTuple: RectTuple, color: Color, fill: Color) {
  const [, , width, height] = rectTuple
  if (width <= 0 || height <= 0) return
  const rect = toScreenRect(r, rectTuple)
  r.auxFill.setColor(canvasColor(r, fill))
  canvas.drawRect(rect, r.auxFill)

  const path = new r.ck.Path()
  const left = rect[0]
  const top = rect[1]
  const right = rect[2]
  const bottom = rect[3]
  for (let sx = left - (bottom - top); sx < right; sx += AUTO_LAYOUT_HOVER_STRIPE_GAP) {
    path.moveTo(sx, bottom)
    path.lineTo(sx + (bottom - top), top)
  }
  r.auxStroke.setStrokeWidth(AUTO_LAYOUT_HOVER_STRIPE_WIDTH)
  r.auxStroke.setColor(canvasColor(r, color))
  r.auxStroke.setPathEffect(null)
  canvas.save()
  canvas.clipRect(rect, r.ck.ClipOp.Intersect, true)
  canvas.drawPath(path, r.auxStroke)
  canvas.restore()
  path.delete()
}

function drawValuePill(r: SkiaRenderer, canvas: Canvas, text: string, x: number, y: number) {
  if (!r.labelFont) return
  const width = Math.max(24, text.length * 8 + AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X * 2)
  const height = AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT
  const rect = r.ck.RRectXY(
    r.ck.LTRBRect(x - width / 2, y - height / 2, x + width / 2, y + height / 2),
    AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS,
    AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS
  )
  r.auxFill.setColor(r.selColor())
  canvas.drawRRect(rect, r.auxFill)
  r.auxFill.setColor(r.ck.Color4f(1, 1, 1, 1))
  canvas.drawText(
    text,
    x - width / 2 + AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X,
    y + 5,
    r.auxFill,
    r.labelFont
  )
}

function gapRects(node: SceneNode, graph: SceneGraph): RectTuple[] {
  const children = visibleLayoutChildren(node, graph)
  if (children.length < 2 || node.itemSpacing <= 0) return []
  const abs = graph.getAbsolutePosition(node.id)
  const isRow = node.layoutMode === 'HORIZONTAL'
  const rects: RectTuple[] = []

  for (let i = 0; i < children.length - 1; i++) {
    const prev = children[i]
    const next = children[i + 1]
    const gapStart = isRow ? prev.x + prev.width : prev.y + prev.height
    const gapEnd = isRow ? next.x : next.y
    if (gapEnd <= gapStart) continue
    rects.push(
      isRow
        ? [
            abs.x + gapStart,
            abs.y + node.paddingTop,
            gapEnd - gapStart,
            node.height - node.paddingTop - node.paddingBottom
          ]
        : [
            abs.x + node.paddingLeft,
            abs.y + gapStart,
            node.width - node.paddingLeft - node.paddingRight,
            gapEnd - gapStart
          ]
    )
  }
  return rects
}

function paddingRect(node: SceneNode, graph: SceneGraph, side: Hover['side']): RectTuple | null {
  if (!side) return null
  const abs = graph.getAbsolutePosition(node.id)
  if (side === 'top') return [abs.x, abs.y, node.width, node.paddingTop]
  if (side === 'bottom') {
    return [abs.x, abs.y + node.height - node.paddingBottom, node.width, node.paddingBottom]
  }
  if (side === 'left') return [abs.x, abs.y, node.paddingLeft, node.height]
  return [abs.x + node.width - node.paddingRight, abs.y, node.paddingRight, node.height]
}

function drawBaselineTicks(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, node: SceneNode) {
  const abs = graph.getAbsolutePosition(node.id)
  const xCenter = (abs.x + node.width / 2) * r.zoom + r.panX
  const yCenter = (abs.y + node.height / 2) * r.zoom + r.panY

  setStroke(r, AUTO_LAYOUT_HOVER_BLUE)
  if (node.paddingTop > 0) {
    drawHorizontalTick(r, canvas, xCenter, (abs.y + node.paddingTop / 2) * r.zoom + r.panY)
  }
  if (node.paddingBottom > 0) {
    drawHorizontalTick(
      r,
      canvas,
      xCenter,
      (abs.y + node.height - node.paddingBottom / 2) * r.zoom + r.panY
    )
  }
  if (node.paddingLeft > 0) {
    drawVerticalTick(r, canvas, (abs.x + node.paddingLeft / 2) * r.zoom + r.panX, yCenter)
  }
  if (node.paddingRight > 0) {
    drawVerticalTick(
      r,
      canvas,
      (abs.x + node.width - node.paddingRight / 2) * r.zoom + r.panX,
      yCenter
    )
  }

  setStroke(r, AUTO_LAYOUT_HOVER_MAGENTA)
  for (const rect of gapRects(node, graph)) {
    const [x, y, width, height] = rect
    if (node.layoutMode === 'HORIZONTAL') {
      drawVerticalTick(r, canvas, (x + width / 2) * r.zoom + r.panX, yCenter)
    } else {
      drawHorizontalTick(r, canvas, xCenter, (y + height / 2) * r.zoom + r.panY)
    }
  }
}

function drawSpacingHover(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  showValue: boolean
) {
  const rects = gapRects(node, graph)
  for (const rect of rects) {
    drawStripedRect(
      r,
      canvas,
      rect,
      AUTO_LAYOUT_HOVER_MAGENTA,
      AUTO_LAYOUT_HOVER_MAGENTA_FILL
    )
  }
  if (!showValue || rects.length === 0) return
  const [x, y, width, height] = rects[0]
  drawValuePill(
    r,
    canvas,
    String(Math.round(node.itemSpacing)),
    (x + width / 2) * r.zoom + r.panX + AUTO_LAYOUT_HOVER_VALUE_OFFSET,
    (y + height / 2) * r.zoom + r.panY - AUTO_LAYOUT_HOVER_VALUE_OFFSET
  )
}

function drawPaddingHover(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  hover: Hover,
  showValue: boolean
) {
  const rect = paddingRect(node, graph, hover.side)
  if (!rect) return
  drawStripedRect(r, canvas, rect, AUTO_LAYOUT_HOVER_BLUE, AUTO_LAYOUT_HOVER_BLUE_FILL)
  if (!showValue) return
  const [x, y, width, height] = rect
  const value = hover.side === 'left' || hover.side === 'right' ? width : height
  drawValuePill(
    r,
    canvas,
    String(Math.round(value)),
    (x + width / 2) * r.zoom + r.panX + AUTO_LAYOUT_HOVER_VALUE_OFFSET,
    (y + height / 2) * r.zoom + r.panY - AUTO_LAYOUT_HOVER_VALUE_OFFSET
  )
}

function drawChildrenHover(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, node: SceneNode) {
  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(
    r.ck.PathEffect.MakeDash([AUTO_LAYOUT_HOVER_CHILD_DASH, AUTO_LAYOUT_HOVER_CHILD_DASH], 0)
  )
  for (const child of visibleLayoutChildren(node, graph)) {
    const abs = graph.getAbsolutePosition(child.id)
    canvas.drawRect(
      r.ck.LTRBRect(
        abs.x * r.zoom + r.panX,
        abs.y * r.zoom + r.panY,
        (abs.x + child.width) * r.zoom + r.panX,
        (abs.y + child.height) * r.zoom + r.panY
      ),
      r.auxStroke
    )
  }
  r.auxStroke.setPathEffect(null)
}

export function drawAutoLayoutHover(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hover?: RenderOverlays['autoLayoutHover']
): void {
  if (!hover) return
  const node = graph.getNode(hover.nodeId)
  if (!node || (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL')) return

  if (hover.kind === 'children') drawChildrenHover(r, canvas, graph, node)
  if (hover.kind === 'spacing' || hover.kind === 'spacing-value') {
    drawSpacingHover(r, canvas, graph, node, hover.kind === 'spacing-value')
  }
  if (hover.kind === 'padding' || hover.kind === 'padding-value') {
    drawPaddingHover(r, canvas, graph, node, hover, hover.kind === 'padding-value')
  }
  drawBaselineTicks(r, canvas, graph, node)
}
