import type { Canvas, Path } from 'canvaskit-wasm'

import type { Color, SceneGraph, Vector } from '@open-pencil/scene-graph'

import { getCachedMaskBlur } from '#core/canvas/effects'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { editedGradient, editedGradientLayout } from '#core/editor/gradient-edit'
import type { GradientEdit } from '#core/editor/types'
import { GRADIENT_HANDLE, type GradientHandleLayout, type RotationPreview } from '#core/geometry'

/** Colours measured on Figma desktop 126's gradient handles. */
const SELECTED_BORDER = { r: 0x4b / 255, g: 0x9e / 255, b: 0xf4 / 255 }
const STOP_BORDER = { r: 0xd0 / 255, g: 0xd0 / 255, b: 0xd0 / 255 }
const SHADOW_ALPHA = 0.35
const SHADOW_BLUR = 1
const POINTER_HALF_WIDTH = 3

function polyline(r: SkiaRenderer, points: readonly Vector[], close: boolean) {
  const path = new r.ck.PathBuilder()
  points.forEach((point, index) =>
    index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)
  )
  if (close) path.close()
  return path.detachAndDelete()
}

/** The angular gradient's ellipse: a unit circle mapped onto its two axes. */
function ellipsePath(r: SkiaRenderer, ellipse: NonNullable<GradientHandleLayout['ellipse']>) {
  const { center, radiusX, radiusY } = ellipse
  const path = new r.ck.PathBuilder()
  path.addOval(r.ck.LTRBRect(-1, -1, 1, 1))
  path.transform([
    radiusX.x - center.x,
    radiusY.x - center.x,
    center.x,
    radiusX.y - center.y,
    radiusY.y - center.y,
    center.y,
    0,
    0,
    1
  ])
  return path.detachAndDelete()
}

/** A white 1 px line over a soft shadow, as Figma draws the gradient's axis and ellipse. */
function strokeWithShadow(r: SkiaRenderer, canvas: Canvas, path: Path) {
  const paint = r.auxStroke
  paint.setPathEffect(null)
  paint.setStrokeWidth(1)
  paint.setMaskFilter(getCachedMaskBlur(r, SHADOW_BLUR))
  paint.setColor(r.ck.Color4f(0, 0, 0, SHADOW_ALPHA))
  canvas.drawPath(path, paint)
  paint.setMaskFilter(null)
  paint.setColor(r.ck.Color4f(1, 1, 1, 1))
  canvas.drawPath(path, paint)
  path.delete()
}

function drawDot(r: SkiaRenderer, canvas: Canvas, point: Vector) {
  const paint = r.auxFill
  paint.setMaskFilter(getCachedMaskBlur(r, SHADOW_BLUR))
  paint.setColor(r.ck.Color4f(0, 0, 0, SHADOW_ALPHA))
  canvas.drawCircle(point.x, point.y + 0.5, GRADIENT_HANDLE.dotRadius, paint)
  paint.setMaskFilter(null)
  paint.setColor(r.ck.Color4f(1, 1, 1, 1))
  canvas.drawCircle(point.x, point.y, GRADIENT_HANDLE.dotRadius, paint)
}

/** The stop's square: a 2 px border, a 1 px white ring, its colour, and a pointer to its spot. */
function drawStop(
  r: SkiaRenderer,
  canvas: Canvas,
  stop: GradientHandleLayout['stops'][number],
  color: Color,
  selected: boolean
) {
  const half = GRADIENT_HANDLE.stopSize / 2
  const border = selected ? SELECTED_BORDER : STOP_BORDER
  const paint = r.auxFill
  paint.setMaskFilter(null)
  paint.setColor(r.ck.Color4f(border.r, border.g, border.b, 1))
  // The pointer leaves the square's edge facing the spot it marks.
  const { center, pointing } = stop
  const edge = {
    x: center.x + pointing.x * half,
    y: center.y + pointing.y * half
  }
  const across = { x: -pointing.y, y: pointing.x }
  const tip = {
    x: edge.x + pointing.x * POINTER_HALF_WIDTH,
    y: edge.y + pointing.y * POINTER_HALF_WIDTH
  }
  const pointer = polyline(
    r,
    [
      { x: edge.x + across.x * POINTER_HALF_WIDTH, y: edge.y + across.y * POINTER_HALF_WIDTH },
      tip,
      { x: edge.x - across.x * POINTER_HALF_WIDTH, y: edge.y - across.y * POINTER_HALF_WIDTH }
    ],
    true
  )
  canvas.drawPath(pointer, paint)
  pointer.delete()
  const rect = (inset: number) =>
    r.ck.LTRBRect(
      center.x - half + inset,
      center.y - half + inset,
      center.x + half - inset,
      center.y + half - inset
    )
  canvas.drawRect(rect(0), paint)
  paint.setColor(r.ck.Color4f(1, 1, 1, 1))
  canvas.drawRect(rect(2), paint)
  paint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  canvas.drawRect(rect(3), paint)
}

/** Figma's on-canvas gradient handles, for the paint whose picker is open. */
export function drawGradientHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  edit: GradientEdit | null | undefined,
  preview?: RotationPreview | null
): void {
  const layout = editedGradientLayout(graph, edit, r, preview)
  const edited = editedGradient(graph, edit)
  if (!layout || !edited || !edit) return
  if (layout.ellipse) strokeWithShadow(r, canvas, ellipsePath(r, layout.ellipse))
  strokeWithShadow(r, canvas, polyline(r, [layout.line.from, layout.line.to], false))
  for (const dot of layout.dots) drawDot(r, canvas, dot.point)
  const stops = edited.paint.gradientStops ?? []
  // The selected stop draws last, over any square it overlaps.
  const order = [...layout.stops].sort(
    (a, b) => Number(a.index === edit.stop) - Number(b.index === edit.stop)
  )
  for (const stop of order) {
    const color = stops.at(stop.index)?.color
    if (color) drawStop(r, canvas, stop, color, stop.index === edit.stop)
  }
}
