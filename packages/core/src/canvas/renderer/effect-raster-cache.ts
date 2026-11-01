import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { arrowCapOverflow } from '@open-pencil/scene-graph/arrow-caps'

import type { SkiaRenderer } from '#core/canvas/renderer'

/**
 * Draws a shape with effects from its cached picture, recording one when there is none: the
 * picture holds the shape with its shadows and blurs, so a tile that holds it again replays it
 * rather than building the effects again.
 */
export function renderShapeThroughEffectCaches(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  draw: (target: Canvas) => void
): void {
  const cached = r.nodePictures.get(node.id)
  if (cached?.picture && cached.fontGeneration === r.fontGeneration) {
    canvas.drawPicture(cached.picture)
    return
  }
  cached?.picture?.delete()
  r.nodePictures.delete(node.id)

  // An arrow head reaches past the shape, and its shadow reaches past the head: both margins.
  const margin =
    r.effectOverflow(node) + arrowCapOverflow(node.strokes, node.strokeCap, node.vectorNetwork)
  const bounds = r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
  const recorder = new r.ck.PictureRecorder()
  try {
    const recCanvas = recorder.beginRecording(bounds)
    draw(recCanvas)
    const picture = recorder.finishRecordingAsPicture()
    r.nodePictures.set(node.id, { picture, fontGeneration: r.fontGeneration })
    canvas.drawPicture(picture)
  } finally {
    recorder.delete()
  }
}
