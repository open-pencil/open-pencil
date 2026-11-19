import type { Canvas } from '@open-pencil/canvaskit'
import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'

import { hasImageAdjustments } from '#core/canvas/images/adjustments'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { localPaintBounds } from '#core/geometry/render-bounds'

function imagePaints(node: SceneNode): Fill[] {
  const regionFills = node.vectorNetwork?.regions.flatMap((region) => region.fills ?? []) ?? []
  return [...node.fills, ...node.strokes, ...regionFills].filter(
    (paint) => paint.visible && paint.imageHash !== undefined
  )
}

function drawsImage(node: SceneNode): boolean {
  return imagePaints(node).length > 0
}

function drawsAdjustedImage(node: SceneNode): boolean {
  return imagePaints(node).some((paint) => hasImageAdjustments(paint.filters))
}

/** Noise samples once per output pixel in an export, so it follows that export's pixel grid. */
function drawsNoise(node: SceneNode): boolean {
  return node.effects.some((effect) => effect.visible && effect.type === 'NOISE')
}

/**
 * Its sampling depends on where the layer lands on the export's pixels, which no key follows:
 * an image's, and a noise's, which is taken once per output pixel.
 */
function samplesImagesForExport(r: SkiaRenderer, node: SceneNode): boolean {
  return r.images.supersampledOutput !== null && (drawsImage(node) || drawsNoise(node))
}

function drawsBakedImagesForExport(r: SkiaRenderer, node: SceneNode): boolean {
  return r.images.exporting !== null && drawsAdjustedImage(node)
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
  if (samplesImagesForExport(r, node) || drawsBakedImagesForExport(r, node)) {
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
