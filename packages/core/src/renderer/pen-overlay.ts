import {
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
} from '../constants'
import type { SceneGraph } from '../scene-graph'
import type { Vector } from '../types'
import type { Canvas, Paint } from 'canvaskit-wasm'
import type { SkiaRenderer, RenderOverlays } from './renderer'

type ToScreenFn = (x: number, y: number) => Vector

function buildPenPath(
  r: SkiaRenderer,
  canvas: Canvas,
  penState: NonNullable<RenderOverlays['penState']>,
  toScreen: ToScreenFn
): void {
  const { vertices, segments, dragTangent, cursorX, cursorY } = penState

  const path = new r.ck.Path()
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

  canvas.drawPath(path, r.penPathPaint)
  path.delete()
}

function drawPenHandlePoint(
  canvas: Canvas,
  x: number,
  y: number,
  vertexFill: Paint,
  handlePaint: Paint
): void {
  canvas.drawCircle(x, y, PEN_HANDLE_RADIUS, vertexFill)
  canvas.drawCircle(x, y, PEN_HANDLE_RADIUS, handlePaint)
}

function drawPenTangentHandles(
  canvas: Canvas,
  penState: NonNullable<RenderOverlays['penState']>,
  toScreen: ToScreenFn,
  handlePaint: Paint,
  vertexFill: Paint
): void {
  const { vertices, segments, dragTangent } = penState

  for (const seg of segments) {
    const ts = seg.tangentStart
    const te = seg.tangentEnd
    if (ts.x !== 0 || ts.y !== 0) {
      const s = toScreen(vertices[seg.start].x, vertices[seg.start].y)
      const cp = toScreen(vertices[seg.start].x + ts.x, vertices[seg.start].y + ts.y)
      canvas.drawLine(s.x, s.y, cp.x, cp.y, handlePaint)
      drawPenHandlePoint(canvas, cp.x, cp.y, vertexFill, handlePaint)
    }
    if (te.x !== 0 || te.y !== 0) {
      const e = toScreen(vertices[seg.end].x, vertices[seg.end].y)
      const cp = toScreen(vertices[seg.end].x + te.x, vertices[seg.end].y + te.y)
      canvas.drawLine(e.x, e.y, cp.x, cp.y, handlePaint)
      drawPenHandlePoint(canvas, cp.x, cp.y, vertexFill, handlePaint)
    }
  }

  if (dragTangent && vertices.length > 0) {
    const last = vertices[vertices.length - 1]
    const cp1 = toScreen(last.x + dragTangent.x, last.y + dragTangent.y)
    const cp2 = toScreen(last.x - dragTangent.x, last.y - dragTangent.y)
    canvas.drawLine(cp2.x, cp2.y, cp1.x, cp1.y, handlePaint)
    drawPenHandlePoint(canvas, cp1.x, cp1.y, vertexFill, handlePaint)
    drawPenHandlePoint(canvas, cp2.x, cp2.y, vertexFill, handlePaint)
  }
}

export function drawPenOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  penState: RenderOverlays['penState']
): void {
  if (!penState || penState.vertices.length === 0) return

  const { vertices } = penState
  const vertexFill = r.penVertexFill
  const vertexStroke = r.penVertexStroke

  const toScreen: ToScreenFn = (x, y) => ({
    x: x * r.zoom + r.panX,
    y: y * r.zoom + r.panY
  })

  buildPenPath(r, canvas, penState, toScreen)
  drawPenTangentHandles(canvas, penState, toScreen, r.penHandlePaint, vertexFill)

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

export function drawRemoteCursors(
  r: SkiaRenderer,
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
    const screenX = cursor.x * r.zoom + r.panX
    const screenY = cursor.y * r.zoom + r.panY
    const { r: cr, g, b } = cursor.color

    if (cursor.selection?.length) {
      r.auxStroke.setColor(r.ck.Color4f(cr, g, b, 0.6))
      r.auxStroke.setStrokeWidth(1.5)
      r.auxStroke.setPathEffect(null)
      for (const nodeId of cursor.selection) {
        const node = graph.getNode(nodeId)
        if (!node) continue
        const abs = graph.getAbsolutePosition(nodeId)
        const sx = abs.x * r.zoom + r.panX
        const sy = abs.y * r.zoom + r.panY
        const sw = node.width * r.zoom
        const sh = node.height * r.zoom
        canvas.drawRect(r.ck.XYWHRect(sx, sy, sw, sh), r.auxStroke)
      }
    }

    const S = CURSOR_SIZE
    const path = new r.ck.Path()
    path.moveTo(screenX, screenY)
    path.lineTo(screenX, screenY + S * 1.35)
    path.lineTo(screenX + S * 0.38, screenY + S * 1.0)
    path.lineTo(screenX + S * 0.72, screenY + S * 1.5)
    path.lineTo(screenX + S * 0.92, screenY + S * 1.38)
    path.lineTo(screenX + S * 0.58, screenY + S * 0.88)
    path.lineTo(screenX + S * 1.0, screenY + S * 0.82)
    path.close()

    r.auxStroke.setColor(r.ck.Color4f(1, 1, 1, 1))
    r.auxStroke.setStrokeWidth(2)
    r.auxStroke.setPathEffect(null)
    canvas.drawPath(path, r.auxStroke)

    r.auxFill.setColor(r.ck.Color4f(cr, g, b, 1))
    canvas.drawPath(path, r.auxFill)
    path.delete()

    if (cursor.name) {
      const font = r.labelFont
      if (font) {
        font.setSize(LABEL_FONT_SIZE)
        const labelX = screenX + LABEL_OFFSET_X
        const labelY = screenY + LABEL_OFFSET_Y
        const glyphIds = font.getGlyphIDs(cursor.name)
        const widths = font.getGlyphWidths(glyphIds)
        let textWidth = 0
        for (const w of widths) textWidth += w

        r.auxFill.setColor(r.ck.Color4f(cr, g, b, 1))
        const bgRect = r.ck.RRectXY(
          r.ck.XYWHRect(
            labelX - LABEL_PADDING_X,
            labelY - LABEL_FONT_SIZE - LABEL_PADDING_Y + 2,
            textWidth + LABEL_PADDING_X * 2,
            LABEL_FONT_SIZE + LABEL_PADDING_Y * 2
          ),
          4,
          4
        )
        canvas.drawRRect(bgRect, r.auxFill)

        r.auxFill.setColor(r.ck.Color4f(1, 1, 1, 1))
        canvas.drawText(cursor.name, labelX, labelY, r.auxFill, font)
      }
    }
  }
}
