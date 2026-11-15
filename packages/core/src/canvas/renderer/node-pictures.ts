import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { localPaintBounds } from '#core/geometry/render-bounds'

function drawsImage(node: SceneNode): boolean {
  const regionFills = node.vectorNetwork?.regions.flatMap((region) => region.fills ?? []) ?? []
  return [...node.fills, ...node.strokes, ...regionFills].some(
    (paint) => paint.visible && paint.imageHash !== undefined
  )
}

/** Its sampling depends on where the layer lands on the export's pixels, which no key follows. */
function samplesImagesForExport(r: SkiaRenderer, node: SceneNode): boolean {
  return r.images.supersampledOutput !== null && drawsImage(node)
}

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
  if (samplesImagesForExport(r, node)) {
    draw(canvas)
    return
  }
  const cached = r.nodePictures.get(node.id)
  if (cached && cached.fontGeneration === r.fontGeneration) {
    canvas.drawPicture(cached.picture)
    return
  }
  cached?.picture.delete()
  r.nodePictures.delete(node.id)

  const castsShadowsInPicture = !isLayerContainer(node)
  const drawn = localPaintBounds(node, castsShadowsInPicture) ?? {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0
  }
  const bounds = r.ck.LTRBRect(drawn.minX, drawn.minY, drawn.maxX, drawn.maxY)
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
