import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { CONNECTOR_LABEL_PADDING, labelledConnector } from '@open-pencil/scene-graph/connectors'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import { paintFills } from '#core/canvas/fills/paint'
import { drawNodeHighlightRect } from '#core/canvas/highlight-rect'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer/skia'
import { connectorLabelPlaceholderNode } from '#core/canvas/text/placeholder'
import {
  DROP_HIGHLIGHT_ALPHA,
  DROP_HIGHLIGHT_STROKE,
  FLASH_ATTACK_MS,
  FLASH_HOLD_MS,
  FLASH_OVERSHOOT,
  FLASH_RELEASE_MS,
  LAYOUT_INDICATOR_STROKE,
  MARQUEE_FILL_ALPHA,
  VERTEX_SNAP_COLOR,
  VERTEX_SNAP_GUIDE_ALPHA,
  VERTEX_SNAP_MARK_RADIUS
} from '#core/constants'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'
import { worldXToScreen, worldYToScreen } from '#core/geometry/viewport'

import { inNodeSpace, outlineNode } from './outline'
import { drawTextEditOverlay } from './text-edit'

export function drawSnapGuides(r: SkiaRenderer, canvas: Canvas, guides?: SnapGuide[]): void {
  if (!guides || guides.length === 0) return

  for (const guide of guides) {
    const paint = guide.marks ? vertexSnapPaint(r, VERTEX_SNAP_GUIDE_ALPHA) : r.snapPaint
    if (guide.axis === 'x') {
      const x = worldXToScreen(r, guide.position)
      const y1 = worldYToScreen(r, guide.from)
      const y2 = worldYToScreen(r, guide.to)
      canvas.drawLine(x, y1, x, y2, paint)
    } else {
      const y = worldYToScreen(r, guide.position)
      const x1 = worldXToScreen(r, guide.from)
      const x2 = worldXToScreen(r, guide.to)
      canvas.drawLine(x1, y, x2, y, paint)
    }
  }
}

/**
 * The crosses on the vertices a guide lines up, drawn over the path's points as Figma does, so a
 * point the pen would land on shows its cross inside its circle.
 */
export function drawSnapMarks(r: SkiaRenderer, canvas: Canvas, guides?: SnapGuide[]): void {
  if (!guides) return
  const paint = vertexSnapPaint(r, 1)
  const arm = VERTEX_SNAP_MARK_RADIUS
  for (const guide of guides) {
    for (const mark of guide.marks ?? []) {
      const along = guide.axis === 'x' ? guide.position : mark
      const across = guide.axis === 'x' ? mark : guide.position
      const x = worldXToScreen(r, along)
      const y = worldYToScreen(r, across)
      canvas.drawLine(x - arm, y - arm, x + arm, y + arm, paint)
      canvas.drawLine(x - arm, y + arm, x + arm, y - arm, paint)
    }
  }
}

function vertexSnapPaint(r: SkiaRenderer, alpha: number) {
  const { r: red, g, b } = VERTEX_SNAP_COLOR
  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColorComponents(red, g, b, alpha)
  return r.auxStroke
}

export function drawMarquee(r: SkiaRenderer, canvas: Canvas, marquee?: Rect | null): void {
  if (!marquee || marquee.width <= 0 || marquee.height <= 0) return

  const x1 = worldXToScreen(r, marquee.x)
  const y1 = worldYToScreen(r, marquee.y)
  const x2 = worldXToScreen(r, marquee.x + marquee.width)
  const y2 = worldYToScreen(r, marquee.y + marquee.height)
  const rect = r.ck.LTRBRect(x1, y1, x2, y2)

  r.auxFill.setColor(r.selColor(MARQUEE_FILL_ALPHA))
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}

export function drawFlashes(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (r.feedback.flashes.length === 0) return

  const now = performance.now()
  const totalMs = FLASH_ATTACK_MS + FLASH_HOLD_MS + FLASH_RELEASE_MS

  for (let i = r.feedback.flashes.length - 1; i >= 0; i--) {
    const flash = r.feedback.flashes[i]
    const elapsed = now - flash.startTime
    if (elapsed > totalMs) {
      r.feedback.flashes.splice(i, 1)
      continue
    }

    let opacity: number
    let extraPad: number

    if (elapsed < FLASH_ATTACK_MS) {
      const t = elapsed / FLASH_ATTACK_MS
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
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

    if (
      !drawNodeHighlightRect(
        r,
        canvas,
        graph,
        flash.nodeId,
        r.selectionTheme.color,
        opacity,
        extraPad
      )
    ) {
      r.feedback.flashes.splice(i, 1)
    }
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
    const y = worldYToScreen(r, indicator.y)
    const x1 = worldXToScreen(r, indicator.x)
    const x2 = worldXToScreen(r, indicator.x + indicator.length)
    canvas.drawLine(x1, y, x2, y, r.auxStroke)
  } else {
    const x = worldXToScreen(r, indicator.x)
    const y1 = worldYToScreen(r, indicator.y)
    const y2 = worldYToScreen(r, indicator.y + indicator.length)
    canvas.drawLine(x, y1, x, y2, r.auxStroke)
  }
}

/** The outline of the frame a dragged layer would drop into. */
export function drawDropTarget(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  dropTargetId?: string | null,
  preview?: RotationPreview | null
): void {
  const stroke = { color: r.selColor(DROP_HIGHLIGHT_ALPHA), width: DROP_HIGHLIGHT_STROKE }
  outlineNode(r, canvas, graph, dropTargetId, stroke, preview)
}

/** The caret and text selection of the text layer being edited, over the layer. */
export function drawEditingText(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: Pick<RenderOverlays, 'editingTextId' | 'textEditor' | 'rotationPreview'>
): void {
  const node = overlays.editingTextId ? graph.getNode(overlays.editingTextId) : undefined
  const editor = overlays.textEditor
  if (!node || !editor?.state?.paragraph) return
  // A connector label is outlined by its plate, as FigJam outlines it, and shows its
  // placeholder while it is empty.
  const outset = labelledConnector(graph, node) ? CONNECTOR_LABEL_PADDING : 0
  const placeholder = connectorLabelPlaceholderNode(
    graph,
    node,
    r.connectorLabelPlaceholder,
    node.id
  )
  inNodeSpace(r, canvas, createSceneGeometry(graph, overlays.rotationPreview), node, () => {
    if (placeholder) {
      paintFills(r, placeholder.fills, placeholder, graph, (fill) =>
        r.renderText(canvas, placeholder, fill)
      )
    }
    drawTextEditOverlay(r, canvas, node, editor, outset)
  })
}
