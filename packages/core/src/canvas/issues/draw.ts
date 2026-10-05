import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  ISSUE_EDGE_ARROW,
  ISSUE_ERROR_COLOR,
  ISSUE_HIGHLIGHT_FILL_ALPHA,
  ISSUE_HIGHLIGHT_STROKE_WIDTH,
  ISSUE_INFO_COLOR,
  ISSUE_MARKER_RING_WIDTH,
  ISSUE_WARNING_COLOR
} from '#core/constants'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

import { issueMarkerLabel } from './layout'
import type { DesignIssueHighlight, DesignIssueSeverity, PlacedIssueMarker } from './types'

const MARKER_SHADOW_SIGMA = 1.5
/** Half the base of an edge pin's chevron. */
const EDGE_ARROW_HALF_WIDTH = 4
const MARKER_SHADOW_OFFSET_Y = 1
const MARKER_SHADOW_ALPHA = 0.3
const MARKER_HOVER_HALO = 3
const MARKER_HOVER_HALO_ALPHA = 0.28
/** Baseline below the vertical center for 10px Inter digits and the exclamation mark. */
const MARKER_TEXT_BASELINE = 3.5
const TARGET_DASH = 3

export function issueSeverityColor(severity: DesignIssueSeverity): Color {
  if (severity === 'error') return ISSUE_ERROR_COLOR
  if (severity === 'warning') return ISSUE_WARNING_COLOR
  return ISSUE_INFO_COLOR
}

/** Amber needs dark text; red and gray read best with white. */
function issueSeverityForeground(severity: DesignIssueSeverity): Color {
  return severity === 'warning' ? { r: 0, g: 0, b: 0, a: 0.85 } : { r: 1, g: 1, b: 1, a: 1 }
}

function color4f(r: SkiaRenderer, color: Color, alpha = color.a) {
  return r.ck.Color4f(color.r, color.g, color.b, alpha)
}

export function drawIssueHighlight(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  highlight: DesignIssueHighlight | null | undefined,
  preview?: RotationPreview | null
): void {
  const node = highlight ? graph.getNode(highlight.nodeId) : undefined
  if (!highlight || !node) return
  const color = issueSeverityColor(highlight.severity)

  canvas.save()
  try {
    canvas.concat(createSceneGeometry(graph, preview).screenMatrix(node, r))
    r.auxFill.setColor(color4f(r, color, ISSUE_HIGHLIGHT_FILL_ALPHA))
    canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxFill)

    r.auxStroke.setPathEffect(null)
    r.auxStroke.setColor(color4f(r, color))
    r.auxStroke.setStrokeWidth(ISSUE_HIGHLIGHT_STROKE_WIDTH / r.zoom)
    r.strokeNodeShape(canvas, node, r.auxStroke)

    const minSize = highlight.minSize
    if (minSize && (node.width < minSize.width || node.height < minSize.height)) {
      const width = Math.max(node.width, minSize.width)
      const height = Math.max(node.height, minSize.height)
      const left = (node.width - width) / 2
      const top = (node.height - height) / 2
      const dash = r.ck.PathEffect.MakeDash([TARGET_DASH / r.zoom, TARGET_DASH / r.zoom], 0)
      r.auxStroke.setStrokeWidth(1 / r.zoom)
      r.auxStroke.setPathEffect(dash)
      canvas.drawRect(r.ck.LTRBRect(left, top, left + width, top + height), r.auxStroke)
      r.auxStroke.setPathEffect(null)
      dash.delete()
    }
  } finally {
    canvas.restore()
  }
}

/**
 * The chevron an edge pin points with: a triangle from the pill's border toward the issues,
 * outlined in white like the pill so it reads on any canvas.
 */
function drawEdgeArrow(
  r: SkiaRenderer,
  canvas: Canvas,
  marker: PlacedIssueMarker,
  color: Color,
  ring: number
): void {
  const { rect, direction } = marker
  if (!direction) return
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const tx = direction.x === 0 ? Infinity : rect.width / 2 / Math.abs(direction.x)
  const ty = direction.y === 0 ? Infinity : rect.height / 2 / Math.abs(direction.y)
  const border = Math.min(tx, ty)
  const normal = { x: -direction.y, y: direction.x }
  const triangle = (reach: number, half: number) => {
    const path = new r.ck.PathBuilder()
    const base = border - 1
    path.moveTo(
      center.x + direction.x * (border + reach),
      center.y + direction.y * (border + reach)
    )
    path.lineTo(
      center.x + direction.x * base + normal.x * half,
      center.y + direction.y * base + normal.y * half
    )
    path.lineTo(
      center.x + direction.x * base - normal.x * half,
      center.y + direction.y * base - normal.y * half
    )
    path.close()
    return path.detachAndDelete()
  }
  const outline = triangle(ISSUE_EDGE_ARROW + ring * 2, EDGE_ARROW_HALF_WIDTH + ring)
  const fill = triangle(ISSUE_EDGE_ARROW, EDGE_ARROW_HALF_WIDTH)
  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawPath(outline, r.auxFill)
  r.auxFill.setColor(color4f(r, color))
  canvas.drawPath(fill, r.auxFill)
  outline.delete()
  fill.delete()
}

function drawMarker(
  r: SkiaRenderer,
  canvas: Canvas,
  marker: PlacedIssueMarker,
  hovered: boolean
): void {
  const { rect } = marker
  const radius = rect.height / 2
  const color = issueSeverityColor(marker.severity)
  const ring = ISSUE_MARKER_RING_WIDTH

  const shadow = r.ck.RRectXY(
    r.ck.LTRBRect(
      rect.x - ring,
      rect.y - ring + MARKER_SHADOW_OFFSET_Y,
      rect.x + rect.width + ring,
      rect.y + rect.height + ring + MARKER_SHADOW_OFFSET_Y
    ),
    radius + ring,
    radius + ring
  )
  r.auxFill.setColor(r.ck.Color4f(0, 0, 0, MARKER_SHADOW_ALPHA))
  r.auxFill.setMaskFilter(r.getCachedMaskBlur(MARKER_SHADOW_SIGMA))
  canvas.drawRRect(shadow, r.auxFill)
  r.auxFill.setMaskFilter(null)

  if (hovered) {
    const halo = ring + MARKER_HOVER_HALO
    r.auxFill.setColor(color4f(r, color, MARKER_HOVER_HALO_ALPHA))
    canvas.drawRRect(
      r.ck.RRectXY(
        r.ck.LTRBRect(
          rect.x - halo,
          rect.y - halo,
          rect.x + rect.width + halo,
          rect.y + rect.height + halo
        ),
        radius + halo,
        radius + halo
      ),
      r.auxFill
    )
  }

  if (marker.direction) drawEdgeArrow(r, canvas, marker, color, ring)

  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawRRect(
    r.ck.RRectXY(
      r.ck.LTRBRect(
        rect.x - ring,
        rect.y - ring,
        rect.x + rect.width + ring,
        rect.y + rect.height + ring
      ),
      radius + ring,
      radius + ring
    ),
    r.auxFill
  )
  r.auxFill.setColor(color4f(r, color))
  canvas.drawRRect(
    r.ck.RRectXY(
      r.ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height),
      radius,
      radius
    ),
    r.auxFill
  )

  const font = r.sizeFont
  if (!font) return
  const label = issueMarkerLabel(marker.count)
  let textWidth = 0
  for (const width of font.getGlyphWidths(font.getGlyphIDs(label))) textWidth += width
  font.setEmbolden(true)
  r.auxFill.setColor(color4f(r, issueSeverityForeground(marker.severity)))
  canvas.drawText(
    label,
    rect.x + (rect.width - textWidth) / 2,
    rect.y + rect.height / 2 + MARKER_TEXT_BASELINE,
    r.auxFill,
    font
  )
  font.setEmbolden(false)
}

/** Draws placed markers so the first placed, most severe marker ends up on top. */
export function drawIssueMarkers(
  r: SkiaRenderer,
  canvas: Canvas,
  placed: readonly PlacedIssueMarker[],
  hoveredKey: string | null | undefined
): void {
  for (let index = placed.length - 1; index >= 0; index--) {
    const marker = placed[index]
    drawMarker(r, canvas, marker, marker.key === hoveredKey)
  }
}
