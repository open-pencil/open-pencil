import type { Canvas, Image, Shader } from '@open-pencil/canvaskit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { compiledProgram, fillWithShader } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { NOISE_GRAIN, noiseTileInputs, noiseUniforms } from './shader'
import { noiseColorTile, noiseLevelTile } from './tile'

/** Catmull-Rom as Skia's cubic resampler: B 0, C 0.5, the blend Figma's grains were fitted to. */
const CATMULL_ROM = { B: 0, C: 0.5 }

/** `tile` as a repeating shader in cell units, blended between cells or one value per cell. */
function tileShader(r: SkiaRenderer, tile: Image, blend: boolean): Shader {
  const repeat = r.ck.TileMode.Repeat
  return blend
    ? tile.makeShaderCubic(repeat, repeat, CATMULL_ROM.B, CATMULL_ROM.C)
    : tile.makeShaderOptions(repeat, repeat, r.ck.FilterMode.Nearest, r.ck.MipmapMode.None)
}

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
  const program = compiledProgram(r.ck, r.shaders, NOISE_GRAIN)
  for (const effect of noises) {
    const { shares, seed, blend } = noiseTileInputs(effect)
    const levelTile = noiseLevelTile(r, shares, seed)
    // Only a multitone reads cell colours; the others bind the levels in their place.
    const colorTile = effect.noise?.noiseType === 'MULTITONE' ? noiseColorTile(r, seed) : levelTile
    if (!levelTile || !colorTile) continue
    const levels = tileShader(r, levelTile, blend)
    const colors = tileShader(r, colorTile, false)
    const shader = program.effect.makeShaderWithChildren(
      program.uniforms(noiseUniforms(effect, layerToOutput)),
      [levels, colors]
    )
    try {
      canvas.save()
      r.clipNodeShape(canvas, node)
      fillWithShader(canvas, r.auxFill, shader, r.ck.LTRBRect(0, 0, node.width, node.height))
      canvas.restore()
    } finally {
      shader.delete()
      levels.delete()
      colors.delete()
    }
  }
}
