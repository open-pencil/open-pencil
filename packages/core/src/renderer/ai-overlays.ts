import {
  FLASH_PADDING,
  FLASH_STROKE_WIDTH,
  FLASH_RADIUS,
  AI_ACTIVE_COLOR,
  AI_DONE_COLOR,
  AI_PULSE_PERIOD_MS,
  AI_DONE_DURATION_MS
} from '../constants'

import type { SceneGraph } from '../scene-graph'
import type { Canvas } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

function drawAiNodeOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  color: { r: number; g: number; b: number },
  opacity: number
): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  const ck = r.ck
  const abs = graph.getAbsolutePosition(nodeId)
  const cx = (abs.x + node.width / 2) * r.zoom + r.panX
  const cy = (abs.y + node.height / 2) * r.zoom + r.panY
  const hw = (node.width / 2) * r.zoom
  const hh = (node.height / 2) * r.zoom
  const pad = FLASH_PADDING

  if (!r._flashPaint) {
    r._flashPaint = new ck.Paint()
    r._flashPaint.setStyle(ck.PaintStyle.Stroke)
    r._flashPaint.setAntiAlias(true)
  }

  const paint = r._flashPaint
  paint.setColor(ck.Color4f(color.r, color.g, color.b, opacity))
  paint.setStrokeWidth(FLASH_STROKE_WIDTH)

  canvas.save()
  if (node.rotation !== 0) canvas.rotate(node.rotation, cx, cy)
  const rect = ck.RRectXY(
    ck.LTRBRect(cx - hw - pad, cy - hh - pad, cx + hw + pad, cy + hh + pad),
    FLASH_RADIUS, FLASH_RADIUS
  )
  canvas.drawRRect(rect, paint)
  canvas.restore()
}

export function drawAiOverlays(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  const now = performance.now()

  for (const nodeId of r._aiActiveNodes) {
    const phase = (now % AI_PULSE_PERIOD_MS) / AI_PULSE_PERIOD_MS
    const opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
    drawAiNodeOverlay(r, canvas, graph, nodeId, AI_ACTIVE_COLOR, opacity)
  }

  for (let i = r._aiDoneFlashes.length - 1; i >= 0; i--) {
    const flash = r._aiDoneFlashes[i]
    const elapsed = now - flash.startTime
    if (elapsed > AI_DONE_DURATION_MS) {
      r._aiDoneFlashes.splice(i, 1)
      continue
    }
    const t = elapsed / AI_DONE_DURATION_MS
    const opacity = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
    drawAiNodeOverlay(r, canvas, graph, flash.nodeId, AI_DONE_COLOR, opacity)
  }
}
