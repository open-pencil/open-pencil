import type { Canvas, SkPicture } from 'canvaskit-wasm'

import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer'

/** Run `draw` with the renderer's culling viewport set to world-space `bounds`. */
export function withWorldViewport<T>(r: SkiaRenderer, bounds: VisualBounds, draw: () => T): T {
  const previous = r.worldViewport
  r.worldViewport = {
    x: bounds.minX,
    y: bounds.minY,
    w: bounds.maxX - bounds.minX,
    h: bounds.maxY - bounds.minY
  }
  try {
    return draw()
  } finally {
    r.worldViewport = previous
  }
}

/** Record `draw` into a picture of world-space `bounds`. The caller owns the picture. */
export function recordWorldPicture(
  r: SkiaRenderer,
  bounds: VisualBounds,
  draw: (canvas: Canvas) => void
): SkPicture {
  const recorder = new r.ck.PictureRecorder()
  try {
    const canvas = recorder.beginRecording(
      r.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
    )
    withWorldViewport(r, bounds, () => draw(canvas))
    return recorder.finishRecordingAsPicture()
  } finally {
    recorder.delete()
  }
}
