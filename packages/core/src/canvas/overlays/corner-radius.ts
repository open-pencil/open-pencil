import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  HANDLE_HALF_SIZE,
  SIZE_FONT_SIZE,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_RADIUS
} from '#core/constants'
import type { CornerRadiusHover } from '#core/editor/types'
import {
  CORNER_RADIUS_HANDLE,
  cornerRadiusHandleLayout,
  cornerRadii,
  createSceneGeometry,
  type RotationPreview
} from '#core/geometry'

/**
 * The selected rectangle's corner radius handles while the pointer is over it: white circles the
 * size of the resize handles with a border in the selection colour, dotted when a drag changes one
 * corner, and a "Radius" label by the pointer for the handle in use, as in Figma desktop.
 */
export function drawCornerRadiusHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  hover: CornerRadiusHover | null | undefined,
  preview?: RotationPreview | null
): void {
  if (!hover || selectedIds.size !== 1 || !selectedIds.has(hover.nodeId)) return
  const node = graph.getNode(hover.nodeId)
  if (!node) return
  const handles = cornerRadiusHandleLayout(node, createSceneGeometry(graph, preview), r)
  if (!handles) return
  const color = r.outlineColor(node, graph)
  const fill = r.auxFill
  const border = r.auxStroke
  fill.setMaskFilter(null)
  border.setPathEffect(null)
  border.setStrokeWidth(1)
  border.setColor(color)
  for (const { point } of handles) {
    fill.setColor(r.ck.WHITE)
    canvas.drawCircle(point.x, point.y, HANDLE_HALF_SIZE, fill)
    canvas.drawCircle(point.x, point.y, HANDLE_HALF_SIZE, border)
    if (!hover.single) continue
    fill.setColor(color)
    canvas.drawCircle(point.x, point.y, CORNER_RADIUS_HANDLE.dotRadius, fill)
  }

  const provider = r.fontProvider
  if (!hover.corner || !provider) return
  // A paragraph rather than the size label's single font, so every script has a fallback face.
  const text = `${hover.label} ${Math.round(cornerRadii(node)[hover.corner])}`
  const white = r.ck.WHITE
  const measured = r.labelParagraphCache.measure(
    r.ck,
    provider,
    text,
    SIZE_FONT_SIZE,
    Number.POSITIVE_INFINITY,
    white,
    r.fontGeneration
  )
  const { labelOffset } = CORNER_RADIUS_HANDLE
  const left = hover.pointer.x + labelOffset.x
  const top = hover.pointer.y + labelOffset.y - SIZE_PILL_HEIGHT / 2
  fill.setColor(color)
  canvas.drawRRect(
    r.ck.RRectXY(
      r.ck.LTRBRect(
        left,
        top,
        left + measured.width + SIZE_PILL_PADDING_X * 2,
        top + SIZE_PILL_HEIGHT
      ),
      SIZE_PILL_RADIUS,
      SIZE_PILL_RADIUS
    ),
    fill
  )
  r.labelParagraphCache.draw(
    r.ck,
    canvas,
    provider,
    text,
    SIZE_FONT_SIZE,
    Number.POSITIVE_INFINITY,
    white,
    r.fontGeneration,
    left + SIZE_PILL_PADDING_X,
    top + (SIZE_PILL_HEIGHT - measured.height) / 2
  )
}
