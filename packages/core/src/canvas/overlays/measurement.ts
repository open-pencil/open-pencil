import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  MEASUREMENT_COLOR,
  MEASUREMENT_PILL_HEIGHT,
  MEASUREMENT_PILL_PADDING_X,
  MEASUREMENT_PILL_RADIUS,
  MEASUREMENT_TEXT_BASELINE
} from '#core/constants'

export interface MeasurementSegment {
  axis: 'x' | 'y'
  from: number
  to: number
  cross: number
  value: number
}

function center(start: number, size: number) {
  return start + size / 2
}

function overlapCenter(startA: number, endA: number, startB: number, endB: number) {
  return (Math.max(startA, startB) + Math.min(endA, endB)) / 2
}

function horizontalCross(from: Rect, to: Rect) {
  const fromBottom = from.y + from.height
  const toBottom = to.y + to.height
  if (fromBottom < to.y) return fromBottom
  if (toBottom < from.y) return from.y
  return overlapCenter(from.y, fromBottom, to.y, toBottom)
}

function verticalCross(from: Rect, to: Rect) {
  const fromRight = from.x + from.width
  const toRight = to.x + to.width
  if (fromRight < to.x) return to.x
  if (toRight < from.x) return toRight
  return overlapCenter(from.x, fromRight, to.x, toRight)
}

export function computeMeasurementSegments(from: Rect, to: Rect): MeasurementSegment[] {
  const segments: MeasurementSegment[] = []
  const fromRight = from.x + from.width
  const toRight = to.x + to.width
  const fromBottom = from.y + from.height
  const toBottom = to.y + to.height

  const fromInsideTo =
    from.x >= to.x && fromRight <= toRight && from.y >= to.y && fromBottom <= toBottom
  const toInsideFrom =
    to.x >= from.x && toRight <= fromRight && to.y >= from.y && toBottom <= fromBottom

  if (fromInsideTo) {
    segments.push(
      {
        axis: 'x',
        from: to.x,
        to: from.x,
        cross: center(from.y, from.height),
        value: from.x - to.x
      },
      {
        axis: 'x',
        from: fromRight,
        to: toRight,
        cross: center(from.y, from.height),
        value: toRight - fromRight
      },
      {
        axis: 'y',
        from: to.y,
        to: from.y,
        cross: center(from.x, from.width),
        value: from.y - to.y
      },
      {
        axis: 'y',
        from: fromBottom,
        to: toBottom,
        cross: center(from.x, from.width),
        value: toBottom - fromBottom
      }
    )
    return segments.filter((segment) => segment.value > 0)
  }

  if (toInsideFrom) {
    return computeMeasurementSegments(to, from)
  }

  if (fromRight <= to.x) {
    segments.push({
      axis: 'x',
      from: fromRight,
      to: to.x,
      cross: horizontalCross(from, to),
      value: to.x - fromRight
    })
  } else if (toRight <= from.x) {
    segments.push({
      axis: 'x',
      from: toRight,
      to: from.x,
      cross: horizontalCross(from, to),
      value: from.x - toRight
    })
  }

  if (fromBottom <= to.y) {
    segments.push({
      axis: 'y',
      from: fromBottom,
      to: to.y,
      cross: verticalCross(from, to),
      value: to.y - fromBottom
    })
  } else if (toBottom <= from.y) {
    segments.push({
      axis: 'y',
      from: toBottom,
      to: from.y,
      cross: verticalCross(from, to),
      value: from.y - toBottom
    })
  }

  return segments.filter((segment) => segment.value > 0 && Number.isFinite(segment.cross))
}

function selectedBounds(graph: SceneGraph, selectedIds: Set<string>): Rect | null {
  const nodes: SceneNode[] = []
  for (const id of selectedIds) {
    const node = graph.getNode(id)
    if (node) nodes.push(node)
  }
  if (nodes.length === 0) return null
  return computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, graph)))
}

function textWidth(r: SkiaRenderer, text: string): number {
  const font = r.sizeFont
  if (!font) return 0
  const widths = font.getGlyphWidths(font.getGlyphIDs(text))
  let width = 0
  for (const glyphWidth of widths) width += glyphWidth
  return width
}

function drawPill(r: SkiaRenderer, canvas: Canvas, text: string, x: number, y: number) {
  const font = r.sizeFont
  if (!font) return
  const width = textWidth(r, text) + MEASUREMENT_PILL_PADDING_X * 2
  const rect = r.ck.RRectXY(
    r.ck.LTRBRect(
      x - width / 2,
      y - MEASUREMENT_PILL_HEIGHT / 2,
      x + width / 2,
      y + MEASUREMENT_PILL_HEIGHT / 2
    ),
    MEASUREMENT_PILL_RADIUS,
    MEASUREMENT_PILL_RADIUS
  )
  r.auxFill.setColor(r.ck.Color4f(MEASUREMENT_COLOR.r, MEASUREMENT_COLOR.g, MEASUREMENT_COLOR.b, 1))
  canvas.drawRRect(rect, r.auxFill)
  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawText(
    text,
    x - width / 2 + MEASUREMENT_PILL_PADDING_X,
    y + MEASUREMENT_TEXT_BASELINE,
    r.auxFill,
    font
  )
}

function drawTargetOutline(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, target: SceneNode) {
  const world = getWorldMatrix(target, graph)
  const view = Matrix.multiply(Matrix.translated(r.panX, r.panY), Matrix.scaled(r.zoom, r.zoom))
  const points = Matrix.mapPoints(Matrix.multiply(view, world), [
    0,
    0,
    target.width,
    0,
    target.width,
    target.height,
    0,
    target.height
  ])
  const path = new r.ck.PathBuilder()
  path.moveTo(points[0], points[1])
  path.lineTo(points[2], points[3])
  path.lineTo(points[4], points[5])
  path.lineTo(points[6], points[7])
  path.close()
  const immutablePath = path.detachAndDelete()
  canvas.drawPath(immutablePath, r.auxStroke)
  immutablePath.delete()
}

export function drawMeasurementSegment(
  r: SkiaRenderer,
  canvas: Canvas,
  segment: MeasurementSegment
): void {
  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(
    r.ck.Color4f(MEASUREMENT_COLOR.r, MEASUREMENT_COLOR.g, MEASUREMENT_COLOR.b, 1)
  )
  r.auxStroke.setPathEffect(null)
  if (segment.axis === 'x') {
    const x1 = segment.from * r.zoom + r.panX
    const x2 = segment.to * r.zoom + r.panX
    const y = segment.cross * r.zoom + r.panY
    canvas.drawLine(x1, y, x2, y, r.auxStroke)
    drawPill(r, canvas, String(Math.round(segment.value)), center(x1, x2 - x1), y)
  } else {
    const x = segment.cross * r.zoom + r.panX
    const y1 = segment.from * r.zoom + r.panY
    const y2 = segment.to * r.zoom + r.panY
    canvas.drawLine(x, y1, x, y2, r.auxStroke)
    drawPill(r, canvas, String(Math.round(segment.value)), x, center(y1, y2 - y1))
  }
}

export function drawMeasurements(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  targetId?: string | null
): void {
  if (!targetId || selectedIds.size === 0 || selectedIds.has(targetId)) return
  const target = graph.getNode(targetId)
  const from = selectedBounds(graph, selectedIds)
  if (!target || !from) return
  const to = getAxisAlignedWorldBounds(target, graph)
  const segments = computeMeasurementSegments(from, to)

  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(
    r.ck.Color4f(MEASUREMENT_COLOR.r, MEASUREMENT_COLOR.g, MEASUREMENT_COLOR.b, 1)
  )
  r.auxStroke.setPathEffect(null)

  drawTargetOutline(r, canvas, graph, target)
  if (segments.length === 0) return

  for (const segment of segments) drawMeasurementSegment(r, canvas, segment)
}
