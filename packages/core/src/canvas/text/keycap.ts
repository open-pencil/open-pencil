import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'

import { keycapFrame } from '#core/text/keycap'

import { appendOutlineCommand } from './outline-path'

/** Draws a keycap frame with `paint`, its pen at `x` on the baseline `y`. */
export function drawKeycapFrame(
  ck: CanvasKit,
  canvas: Canvas,
  x: number,
  y: number,
  size: number,
  paint: Paint
): void {
  const builder = new ck.PathBuilder()
  for (const command of keycapFrame(size)) appendOutlineCommand(builder, command, x, y)
  const path = builder.detachAndDelete()
  try {
    canvas.drawPath(path, paint)
  } finally {
    path.delete()
  }
}
