import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { measureGlyphWidth } from '#core/canvas/labels/paragraph-cache'
import { drawSizePill } from '#core/canvas/labels/selection'
import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  HANDLE_HALF_SIZE,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y
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

  const font = r.sizeFont
  if (!hover.corner || !font) return
  const text = `Radius ${Math.round(cornerRadii(node)[hover.corner])}`
  const width = measureGlyphWidth(font, text) + SIZE_PILL_PADDING_X * 2
  const { labelOffset } = CORNER_RADIUS_HANDLE
  drawSizePill(
    r,
    canvas,
    font,
    text,
    hover.pointer.x + labelOffset.x + width / 2,
    hover.pointer.y + labelOffset.y - SIZE_PILL_HEIGHT / 2 - SIZE_PILL_PADDING_Y,
    color
  )
}
