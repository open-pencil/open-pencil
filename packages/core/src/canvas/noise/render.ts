import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { fillWithShader, keptShader } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { NOISE_GRAIN, noiseUniforms } from './shader'

/** Draws a layer's noise effects over it, inside its outline, in the order they are listed. */
export function renderNoiseEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const noises = node.effects.filter((effect) => effect.visible && effect.type === 'NOISE')
  if (noises.length === 0) return
  const output = r.images.supersampledOutput
  const layerToOutput = output
    ? Matrix.multiply(output.outputFromWorld, getWorldMatrix(node, graph))
    : null
  for (const effect of noises) {
    const shader = keptShader(r.ck, r.shaders, NOISE_GRAIN, noiseUniforms(effect, layerToOutput))
    canvas.save()
    r.clipNodeShape(canvas, node)
    fillWithShader(canvas, r.auxFill, shader, r.ck.LTRBRect(0, 0, node.width, node.height))
    canvas.restore()
  }
}
