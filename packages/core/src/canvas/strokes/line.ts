import type { Canvas, Path } from 'canvaskit-wasm'

import type { SceneNode, Stroke, StrokeCap, VectorNetwork } from '@open-pencil/scene-graph'
import {
  collectArrowEndpoints,
  hasTrimmedShaft,
  lineStrokeEnds,
  trimArrowShafts
} from '@open-pencil/scene-graph/arrow-caps'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  arrowHeadPath,
  configureStrokePaint,
  drawArrowHeads,
  getStrokeCapEntity,
  normalizeDashPattern
} from '#core/canvas/strokes'

import { sideDashSpans } from './sides'

/**
 * The path Figma strokes for a LINE, as a one-segment network its arrow heads follow, and the ends
 * of its shaft, which stops short of a triangle or equilateral head.
 */
export function lineStrokePath(node: SceneNode, weight: number, cap: StrokeCap) {
  const { start, end } = lineStrokeEnds(node.width, node.height, weight, cap)
  const still = { x: 0, y: 0 }
  const network: VectorNetwork = {
    vertices: [start, end],
    segments: [{ start: 0, end: 1, tangentStart: still, tangentEnd: still }],
    regions: []
  }
  const [from, to] = (
    hasTrimmedShaft(network, cap) ? trimArrowShafts(network, cap, weight) : network
  ).vertices
  return { network, from, to }
}

/**
 * Strokes a LINE as Figma does: to one side of the line whatever the alignment, with its caps and
 * heads inside its length, and its dashes stretched to whole periods like a rectangle's side.
 */
export function drawLineStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: Stroke,
  color: Color
): void {
  const cap = stroke.cap ?? node.strokeCap
  const { network, from, to } = lineStrokePath(node, stroke.weight, cap)
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const pattern = normalizeDashPattern(stroke.dashPattern)
  const spans = pattern.length > 0 ? sideDashSpans(length, pattern) : [[0, length]]

  configureStrokePaint(r, node, stroke, color)
  r.strokePaint.setPathEffect(null)
  const at = (distance: number) => (length > 0 ? distance / length : 0)
  for (const [start, end] of spans) {
    canvas.drawLine(
      from.x + (to.x - from.x) * at(start),
      from.y + (to.y - from.y) * at(start),
      from.x + (to.x - from.x) * at(end),
      from.y + (to.y - from.y) * at(end),
      r.strokePaint
    )
  }
  const heads = collectArrowEndpoints(network, cap)
  drawArrowHeads(r, canvas, heads, stroke.weight, color, stroke.opacity)
}

/** The weight and cap a LINE is stroked with: its first visible stroke's. */
function lineStroke(node: SceneNode): { weight: number; cap: StrokeCap } {
  const stroke = node.strokes.find((item) => item.visible)
  return { weight: stroke?.weight ?? 1, cap: stroke?.cap ?? node.strokeCap }
}

/**
 * A LINE as Flatten keeps it: the segment its stroke is drawn along, to one side and inside its
 * caps by half a weight each, so the stroke it keeps lies where it did (live-measured). A line
 * shorter than its weight reverses, as in Figma.
 */
export function makeLineSegmentPath(r: SkiaRenderer, node: SceneNode): Path {
  const { weight, cap } = lineStroke(node)
  const { start, end } = lineStrokeEnds(node.width, node.height, weight, cap, true)
  const segment = new r.ck.PathBuilder()
  segment.moveTo(start.x, start.y)
  segment.lineTo(end.x, end.y)
  return segment.detachAndDelete()
}

/**
 * The outline of a LINE's first visible stroke, as booleans take it: its shaft, its caps, and
 * its heads, without dashes.
 */
export function makeLineStrokeOutline(r: SkiaRenderer, node: SceneNode): Path | null {
  const { weight, cap } = lineStroke(node)
  const { network, from, to } = lineStrokePath(node, weight, cap)
  const shaft = new r.ck.PathBuilder()
  shaft.moveTo(from.x, from.y)
  shaft.lineTo(to.x, to.y)
  const source = shaft.detachAndDelete()
  const outline = source.makeStroked({ width: weight, cap: getStrokeCapEntity(r, cap) })
  source.delete()
  if (!outline) return null
  const builder = new r.ck.PathBuilder()
  builder.addPath(outline)
  outline.delete()
  for (const endpoint of collectArrowEndpoints(network, cap)) {
    const head = arrowHeadPath(r, endpoint, weight)
    if (!head) continue
    builder.addPath(head)
    head.delete()
  }
  return builder.detachAndDelete()
}
