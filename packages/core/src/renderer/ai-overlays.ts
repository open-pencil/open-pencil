import {
  AI_ACTIVE_COLOR,
  AI_DONE_COLOR,
  AI_PULSE_PERIOD_MS,
  AI_DONE_DURATION_MS
} from '../constants'

import { drawNodeHighlightRect } from './highlight-rect'

import type { SceneGraph } from '../scene-graph'
import type { Canvas } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

export function drawAiOverlays(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  const now = performance.now()

  for (const nodeId of r._aiActiveNodes) {
    const phase = (now % AI_PULSE_PERIOD_MS) / AI_PULSE_PERIOD_MS
    const opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
    drawNodeHighlightRect(r, canvas, graph, nodeId, AI_ACTIVE_COLOR, opacity)
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
    drawNodeHighlightRect(r, canvas, graph, flash.nodeId, AI_DONE_COLOR, opacity)
  }
}
