import {
  RULER_SIZE,
  RULER_BADGE_HEIGHT,
  RULER_BADGE_PADDING,
  RULER_BADGE_RADIUS,
  RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE,
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_HIGHLIGHT_ALPHA,
  RULER_TARGET_PIXEL_SPACING,
  RULER_MAJOR_TOLERANCE
} from '../constants'
import type { SceneNode, SceneGraph } from '../scene-graph'
import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

interface SelectionScreenBounds {
  sx1: number
  sx2: number
  sy1: number
  sy2: number
}

function getSelectionScreenBounds(
  r: SkiaRenderer,
  graph: SceneGraph,
  selNodes: SceneNode[]
): SelectionScreenBounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of selNodes) {
    const abs = graph.getAbsolutePosition(n.id)
    minX = Math.min(minX, abs.x)
    minY = Math.min(minY, abs.y)
    maxX = Math.max(maxX, abs.x + n.width)
    maxY = Math.max(maxY, abs.y + n.height)
  }
  return {
    sx1: minX * r.zoom + r.panX,
    sx2: maxX * r.zoom + r.panX,
    sy1: minY * r.zoom + r.panY,
    sy2: maxY * r.zoom + r.panY
  }
}

function drawHorizontalRulerTicks(
  r: SkiaRenderer,
  canvas: Canvas,
  font: InstanceType<CanvasKit['Font']>,
  step: number,
  selBounds: SelectionScreenBounds | null
): void {
  const R = RULER_SIZE
  const vw = r.viewportWidth
  const minorStep = step / 5
  const badgeW = RULER_BADGE_EXCLUSION

  canvas.save()
  canvas.clipRect(r.ck.LTRBRect(R, 0, vw, R), r.ck.ClipOp.Intersect, false)
  const worldLeft = -r.panX / r.zoom
  const worldRight = (vw - r.panX) / r.zoom
  const startX = Math.floor(worldLeft / step) * step

  for (let wx = startX; wx <= worldRight; wx += minorStep) {
    const sx = wx * r.zoom + r.panX
    if (sx < R) continue
    const isMajor = Math.abs(wx % step) < RULER_MAJOR_TOLERANCE
    const tickLen = isMajor ? R * RULER_MAJOR_TICK : R * RULER_MINOR_TICK
    canvas.drawLine(sx, R - tickLen, sx, R, r.rulerTickPaint)

    if (isMajor) {
      const skipForBadge =
        selBounds != null &&
        (Math.abs(sx - selBounds.sx1) < badgeW || Math.abs(sx - selBounds.sx2) < badgeW)
      if (!skipForBadge) {
        canvas.drawText(rulerLabel(wx), sx + 2, R * RULER_TEXT_BASELINE, r.rulerTextPaint, font)
      }
    }
  }
  canvas.restore()
}

function drawVerticalRulerTicks(
  r: SkiaRenderer,
  canvas: Canvas,
  font: InstanceType<CanvasKit['Font']>,
  step: number,
  selBounds: SelectionScreenBounds | null
): void {
  const R = RULER_SIZE
  const vh = r.viewportHeight
  const minorStep = step / 5
  const badgeW = RULER_BADGE_EXCLUSION

  canvas.save()
  canvas.clipRect(r.ck.LTRBRect(0, R, R, vh), r.ck.ClipOp.Intersect, false)
  const worldTop = -r.panY / r.zoom
  const worldBottom = (vh - r.panY) / r.zoom
  const startY = Math.floor(worldTop / step) * step

  for (let wy = startY; wy <= worldBottom; wy += minorStep) {
    const sy = wy * r.zoom + r.panY
    if (sy < R) continue
    const isMajor = Math.abs(wy % step) < RULER_MAJOR_TOLERANCE
    const tickLen = isMajor ? R * RULER_MAJOR_TICK : R * RULER_MINOR_TICK
    canvas.drawLine(R - tickLen, sy, R, sy, r.rulerTickPaint)

    if (isMajor) {
      const skipForBadge =
        selBounds != null &&
        (Math.abs(sy - selBounds.sy1) < badgeW || Math.abs(sy - selBounds.sy2) < badgeW)
      if (!skipForBadge) {
        canvas.save()
        canvas.translate(R * RULER_TEXT_BASELINE, sy - 2)
        canvas.rotate(-90, 0, 0)
        canvas.drawText(rulerLabel(wy), 0, 3, r.rulerTextPaint, font)
        canvas.restore()
      }
    }
  }
  canvas.restore()
}

export function drawRulers(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>
): void {
  const R = RULER_SIZE
  const vw = r.viewportWidth
  const vh = r.viewportHeight
  if (vw === 0 || vh === 0) return

  canvas.drawRect(r.ck.LTRBRect(0, 0, vw, R), r.rulerBgPaint)
  canvas.drawRect(r.ck.LTRBRect(0, R, R, vh), r.rulerBgPaint)
  canvas.drawRect(r.ck.LTRBRect(0, 0, R, R), r.rulerBgPaint)

  const font = r.sizeFont ?? r.textFont
  if (!font) return

  const step = rulerStep(r)
  const selNodes = [...selectedIds]
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  const selBounds = selNodes.length > 0 ? getSelectionScreenBounds(r, graph, selNodes) : null

  drawHorizontalRulerTicks(r, canvas, font, step, selBounds)
  drawVerticalRulerTicks(r, canvas, font, step, selBounds)

  if (selBounds) {
    r.rulerHlPaint.setColor(r.selColor(RULER_HIGHLIGHT_ALPHA))
    canvas.drawRect(r.ck.LTRBRect(Math.max(R, selBounds.sx1), 0, selBounds.sx2, R), r.rulerHlPaint)
    canvas.drawRect(r.ck.LTRBRect(0, Math.max(R, selBounds.sy1), R, selBounds.sy2), r.rulerHlPaint)

    drawRulerBadge(r, canvas, font, Math.round((selBounds.sx1 - r.panX) / r.zoom).toString(), Math.max(R, selBounds.sx1), 0, 'horizontal')
    drawRulerBadge(r, canvas, font, Math.round((selBounds.sx2 - r.panX) / r.zoom).toString(), selBounds.sx2, 0, 'horizontal')
    drawRulerBadge(r, canvas, font, Math.round((selBounds.sy1 - r.panY) / r.zoom).toString(), 0, Math.max(R, selBounds.sy1), 'vertical')
    drawRulerBadge(r, canvas, font, Math.round((selBounds.sy2 - r.panY) / r.zoom).toString(), 0, selBounds.sy2, 'vertical')
  }
}

export function drawRulerBadge(
  r: SkiaRenderer,
  canvas: Canvas,
  font: InstanceType<CanvasKit['Font']>,
  label: string,
  x: number,
  y: number,
  axis: 'horizontal' | 'vertical'
): void {
  const R = RULER_SIZE
  const glyphIds = font.getGlyphIDs(label)
  const widths = font.getGlyphWidths(glyphIds)
  const textW = widths.reduce((s, w) => s + w, 0)
  const pad = RULER_BADGE_PADDING
  const h = RULER_BADGE_HEIGHT

  r.rulerBadgePaint.setColor(r.selColor())

  if (axis === 'horizontal') {
    const bx = x - (textW + pad * 2) / 2
    const by = (R - h) / 2
    canvas.drawRRect(
      r.ck.RRectXY(
        r.ck.LTRBRect(bx, by, bx + textW + pad * 2, by + h),
        RULER_BADGE_RADIUS,
        RULER_BADGE_RADIUS
      ),
      r.rulerBadgePaint
    )
    canvas.drawText(label, bx + pad, R * RULER_TEXT_BASELINE, r.rulerLabelPaint, font)
  } else {
    const bw = textW + pad * 2
    const bx = (R - h) / 2
    const by = y - bw / 2
    canvas.save()
    canvas.translate(bx + h / 2, by + bw / 2)
    canvas.rotate(-90, 0, 0)
    canvas.drawRRect(
      r.ck.RRectXY(
        r.ck.LTRBRect(-bw / 2, -h / 2, bw / 2, h / 2),
        RULER_BADGE_RADIUS,
        RULER_BADGE_RADIUS
      ),
      r.rulerBadgePaint
    )
    canvas.drawText(label, -bw / 2 + pad, h / 2 - 3, r.rulerLabelPaint, font)
    canvas.restore()
  }
}

export function rulerStep(r: SkiaRenderer): number {
  const pixelsPerUnit = r.zoom
  const rawStep = RULER_TARGET_PIXEL_SPACING / pixelsPerUnit
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude

  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

export function rulerLabel(value: number): string {
  return Math.round(value).toString()
}
