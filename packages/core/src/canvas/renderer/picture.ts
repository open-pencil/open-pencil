import type { Canvas, SkPicture } from '@open-pencil/canvaskit'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'

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

/** Record `draw` into a picture of `bounds`. The caller owns the picture. */
export function recordPicture(
  r: SkiaRenderer,
  bounds: Float32Array,
  draw: (canvas: Canvas) => void
): SkPicture {
  const recorder = new r.ck.PictureRecorder()
  r.recordingPictures++
  try {
    draw(recorder.beginRecording(bounds))
    return recorder.finishRecordingAsPicture()
  } finally {
    r.recordingPictures--
    recorder.delete()
  }
}

/** Record `draw` into a picture of world-space `bounds`. The caller owns the picture. */
export function recordWorldPicture(
  r: SkiaRenderer,
  bounds: VisualBounds,
  draw: (canvas: Canvas) => void
): SkPicture {
  return recordPicture(
    r,
    r.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
    (canvas) => withWorldViewport(r, bounds, () => draw(canvas))
  )
}
