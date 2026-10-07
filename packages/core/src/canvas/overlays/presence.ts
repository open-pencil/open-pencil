import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { PresenceCursor, SkiaRenderer } from '#core/canvas/renderer'

const CURSOR_SIZE = 9
const LABEL_PADDING_X = 4
const LABEL_PADDING_Y = 2
const LABEL_FONT_SIZE = 10
const LABEL_OFFSET_X = 12
const LABEL_OFFSET_Y = 20
/** Longer names end with an ellipsis. */
const LABEL_MAX_WIDTH = 160
/** The sparkle that marks an agent's name. */
const LABEL_SPARKLE_RADIUS = 4
const LABEL_SPARKLE_GAP = 3

function drawSelection(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, cursor: PresenceCursor) {
  if (!cursor.selection?.length && !cursor.outline?.length) return
  const { r: red, g, b } = cursor.color
  r.auxStroke.setColor(r.ck.Color4f(red, g, b, 0.6))
  r.auxStroke.setStrokeWidth(1.5)
  r.auxStroke.setPathEffect(null)
  // Outlines of what is not a layer yet, such as JSX an agent is still streaming.
  for (const rect of cursor.outline ?? []) {
    canvas.drawRect(
      r.ck.XYWHRect(
        rect.x * r.zoom + r.panX,
        rect.y * r.zoom + r.panY,
        rect.width * r.zoom,
        rect.height * r.zoom
      ),
      r.auxStroke
    )
  }
  for (const nodeId of cursor.selection ?? []) {
    const node = graph.getNode(nodeId)
    if (!node) continue
    // Map the corners through the node's world matrix, as the shape is rendered, so the
    // box tracks rotation, flips, and parent transforms.
    const corners = Matrix.mapPoints(getWorldMatrix(node, graph), [
      0,
      0,
      node.width,
      0,
      node.width,
      node.height,
      0,
      node.height
    ])
    const box = new r.ck.PathBuilder()
    box.moveTo(corners[0] * r.zoom + r.panX, corners[1] * r.zoom + r.panY)
    for (let i = 2; i < corners.length; i += 2) {
      box.lineTo(corners[i] * r.zoom + r.panX, corners[i + 1] * r.zoom + r.panY)
    }
    box.close()
    const path = box.detachAndDelete()
    canvas.drawPath(path, r.auxStroke)
    path.delete()
  }
}

function arrowPath(r: SkiaRenderer, x: number, y: number) {
  const S = CURSOR_SIZE
  const builder = new r.ck.PathBuilder()
  builder.moveTo(x, y)
  builder.lineTo(x, y + S * 1.35)
  builder.lineTo(x + S * 0.38, y + S * 1.0)
  builder.lineTo(x + S * 0.72, y + S * 1.5)
  builder.lineTo(x + S * 0.92, y + S * 1.38)
  builder.lineTo(x + S * 0.58, y + S * 0.88)
  builder.lineTo(x + S * 1.0, y + S * 0.82)
  builder.close()
  return builder.detachAndDelete()
}

/** A four-point sparkle of radius `R` centered on `cx`, `cy`. */
function sparklePath(r: SkiaRenderer, cx: number, cy: number, R: number) {
  const inner = R * 0.32
  const builder = new r.ck.PathBuilder()
  builder.moveTo(cx, cy - R)
  builder.lineTo(cx + inner, cy - inner)
  builder.lineTo(cx + R, cy)
  builder.lineTo(cx + inner, cy + inner)
  builder.lineTo(cx, cy + R)
  builder.lineTo(cx - inner, cy + inner)
  builder.lineTo(cx - R, cy)
  builder.lineTo(cx - inner, cy - inner)
  builder.close()
  return builder.detachAndDelete()
}

/** The pointer, filled with a person's color, or for an agent its owner's, and outlined in white. */
function drawArrow(r: SkiaRenderer, canvas: Canvas, x: number, y: number, cursor: PresenceCursor) {
  const path = arrowPath(r, x, y)
  r.auxStroke.setColor(r.ck.WHITE)
  r.auxStroke.setStrokeWidth(2)
  r.auxStroke.setPathEffect(null)
  canvas.drawPath(path, r.auxStroke)
  const { r: red, g, b } = cursor.color
  r.auxFill.setColor(r.ck.Color4f(red, g, b, 1))
  canvas.drawPath(path, r.auxFill)
  path.delete()
}

/**
 * A name pill: filled for people; for agents outlined in the owner's color, with a
 * sparkle before the name.
 */
function drawLabel(r: SkiaRenderer, canvas: Canvas, x: number, y: number, cursor: PresenceCursor) {
  const provider = r.fontProvider
  if (!cursor.name || !provider) return
  const { r: red, g, b } = cursor.color
  const color = r.ck.Color4f(red, g, b, 1)
  const agent = cursor.kind === 'agent'
  const badge = agent ? LABEL_SPARKLE_RADIUS * 2 + LABEL_SPARKLE_GAP : 0
  const pillX = x + LABEL_OFFSET_X - LABEL_PADDING_X
  const pillY = y + LABEL_OFFSET_Y - LABEL_FONT_SIZE - LABEL_PADDING_Y + 2
  const pillHeight = LABEL_FONT_SIZE + LABEL_PADDING_Y * 2
  // Shaped like other canvas labels: kerning, fallback fonts, and RTL names.
  r.labelParagraphCache.use(
    r.ck,
    provider,
    cursor.name,
    LABEL_FONT_SIZE,
    LABEL_MAX_WIDTH,
    agent ? color : r.ck.WHITE,
    r.fontGeneration,
    ({ paragraph, metrics }) => {
      const pill = r.ck.RRectXY(
        r.ck.XYWHRect(pillX, pillY, badge + metrics.width + LABEL_PADDING_X * 2, pillHeight),
        4,
        4
      )
      r.auxFill.setColor(agent ? r.ck.WHITE : color)
      canvas.drawRRect(pill, r.auxFill)
      if (agent) {
        r.auxStroke.setColor(color)
        r.auxStroke.setStrokeWidth(1)
        r.auxStroke.setPathEffect(null)
        canvas.drawRRect(pill, r.auxStroke)
        const sparkle = sparklePath(
          r,
          pillX + LABEL_PADDING_X + LABEL_SPARKLE_RADIUS,
          pillY + pillHeight / 2,
          LABEL_SPARKLE_RADIUS
        )
        r.auxFill.setColor(color)
        canvas.drawPath(sparkle, r.auxFill)
        sparkle.delete()
      }
      canvas.drawParagraph(
        paragraph,
        pillX + LABEL_PADDING_X + badge,
        pillY + (pillHeight - metrics.height) / 2
      )
    }
  )
}

/** Cursors of people and agents in screen space, with outlines of what they selected. */
export function drawPresenceCursors(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  cursors?: PresenceCursor[]
): void {
  for (const cursor of cursors ?? []) {
    const x = cursor.x * r.zoom + r.panX
    const y = cursor.y * r.zoom + r.panY
    drawSelection(r, canvas, graph, cursor)
    drawArrow(r, canvas, x, y, cursor)
    drawLabel(r, canvas, x, y, cursor)
  }
}
