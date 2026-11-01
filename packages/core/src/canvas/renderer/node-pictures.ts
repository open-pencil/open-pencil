import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { strokeOverflow } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer'

/**
 * Draws a shape with effects from its node picture, recording one when there is none: the
 * picture holds the shape with its shadows and blurs, so a tile that holds it again replays it
 * rather than building the effects again.
 */
export function drawShapeThroughNodePicture(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  draw: (target: Canvas) => void
): void {
  const cached = r.nodePictures.get(node.id)
  if (cached && cached.fontGeneration === r.fontGeneration) {
    canvas.drawPicture(cached.picture)
    return
  }
  cached?.picture.delete()
  r.nodePictures.delete(node.id)

  // An outside stroke or an arrow head reaches past the shape, and its shadow reaches past that:
  // both margins, so no part of the drawing lies outside the picture's bounds.
  const margin =
    r.effectOverflow(node) + strokeOverflow(node.strokes, node.strokeCap, node.vectorNetwork, node)
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
