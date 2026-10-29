import type { Canvas, Paint } from 'canvaskit-wasm'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  PEN_ANCHOR_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS
} from '#core/constants'

import type { SkiaRenderer, RenderOverlays } from './renderer'

type ToScreenFn = (x: number, y: number) => Vector

/** Build a CanvasKit Path from pen state segments */
function buildSegmentsPath(
  r: SkiaRenderer,
  penState: NonNullable<RenderOverlays['penState']>,
  toScreen: ToScreenFn
): InstanceType<typeof r.ck.Path> {
  const { vertices, segments } = penState
  const path = new r.ck.PathBuilder()
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
  return path.detachAndDelete()
}

/** Build a Path for the preview line from last vertex to cursor */
function buildCursorPath(
  r: SkiaRenderer,
  penState: NonNullable<RenderOverlays['penState']>,
  toScreen: ToScreenFn
): InstanceType<typeof r.ck.Path> | null {
  const { vertices, dragTangent, cursorX, cursorY } = penState
  if (vertices.length === 0) return null

  if (penState.pendingClose && vertices.length > 2) {
    const path = new r.ck.PathBuilder()
    const last = toScreen(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y)
    const first = toScreen(vertices[0].x, vertices[0].y)
    path.moveTo(last.x, last.y)
    if (dragTangent) {
      // Closing preview: segment last -> first, active handle belongs to first vertex.
      const cp2 = toScreen(vertices[0].x + dragTangent.x, vertices[0].y + dragTangent.y)
      path.cubicTo(last.x, last.y, cp2.x, cp2.y, first.x, first.y)
    } else {
      path.lineTo(first.x, first.y)
    }
    return path.detachAndDelete()
  }

  if (cursorX == null || cursorY == null) return null

  const path = new r.ck.PathBuilder()
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
  return path.detachAndDelete()
}

function drawPenPaths(
  r: SkiaRenderer,
  canvas: Canvas,
  penState: NonNullable<RenderOverlays['penState']>,
  toScreen: ToScreenFn
): void {
  // 1) Draw committed segments with live object style (black 2px)
  const segPath = buildSegmentsPath(r, penState, toScreen)
  canvas.drawPath(segPath, r.penLiveStrokePaint)

  // 2) Draw grey 1px tech outline over committed segments
  canvas.drawPath(segPath, r.penPathPaint)
  segPath.delete()

  // 3) Draw the segment to the cursor in the selection color, as Figma previews the next segment
  const cursorPath = buildCursorPath(r, penState, toScreen)
  if (cursorPath) {
    canvas.drawPath(cursorPath, r.penVertexStroke)
    cursorPath.delete()
  }
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
    // During closing, handles are on vertex 0; otherwise on the last vertex
    const anchor = penState.pendingClose ? vertices[0] : vertices[vertices.length - 1]
    const anchorS = toScreen(anchor.x, anchor.y)
    const cp1 = toScreen(anchor.x + dragTangent.x, anchor.y + dragTangent.y)
    const opposite = penState.oppositeDragTangent ?? { x: -dragTangent.x, y: -dragTangent.y }
    const cp2 = toScreen(anchor.x + opposite.x, anchor.y + opposite.y)
    canvas.drawLine(anchorS.x, anchorS.y, cp1.x, cp1.y, handlePaint)
    if (opposite.x !== 0 || opposite.y !== 0) {
      canvas.drawLine(anchorS.x, anchorS.y, cp2.x, cp2.y, handlePaint)
    }
    drawPenHandlePoint(canvas, cp1.x, cp1.y, vertexFill, handlePaint)
    drawPenHandlePoint(canvas, cp2.x, cp2.y, vertexFill, handlePaint)
  }
}

/** The pencil stroke as sampled so far, in the colour and width it will be drawn with. */
export function drawPencilOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  pencilState: RenderOverlays['pencilState']
): void {
  if (!pencilState) return
  const [first, ...rest] = pencilState.points
  const path = new r.ck.PathBuilder()
  path.moveTo(first.x * r.zoom + r.panX, first.y * r.zoom + r.panY)
  if (rest.length === 0) path.lineTo(first.x * r.zoom + r.panX, first.y * r.zoom + r.panY)
  for (const point of rest) path.lineTo(point.x * r.zoom + r.panX, point.y * r.zoom + r.panY)
  const { color, weight } = pencilState.preview
  const paint = r.pencilStrokePaint
  paint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  paint.setStrokeWidth(weight * r.zoom)
  const stroke = path.detachAndDelete()
  canvas.drawPath(stroke, paint)
  stroke.delete()
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

  drawPenPaths(r, canvas, penState, toScreen)
  drawPenTangentHandles(canvas, penState, toScreen, r.penHandlePaint, vertexFill)

  // The point the next segment starts from is solid, as in Figma; the others stay hollow.
  const anchor = penState.pendingClose ? -1 : vertices.length - 1
  for (let i = 0; i < vertices.length; i++) {
    const v = toScreen(vertices[i].x, vertices[i].y)
    if (i === anchor) {
      r.auxFill.setColor(r.selColor())
      canvas.drawCircle(v.x, v.y, PEN_ANCHOR_RADIUS, r.auxFill)
      continue
    }
    const radius =
      i === 0 && penState.closingToFirst
        ? PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST
        : PEN_VERTEX_RADIUS
    canvas.drawCircle(v.x, v.y, radius, vertexFill)
    canvas.drawCircle(v.x, v.y, radius, vertexStroke)
  }

  // Where the next click puts a point; a snapped cursor shows its cross inside this ring.
  const { cursorX, cursorY } = penState
  if (cursorX != null && cursorY != null && !penState.pendingClose && !penState.closingToFirst) {
    const cursor = toScreen(cursorX, cursorY)
    canvas.drawCircle(cursor.x, cursor.y, PEN_VERTEX_RADIUS, vertexStroke)
  }
}
