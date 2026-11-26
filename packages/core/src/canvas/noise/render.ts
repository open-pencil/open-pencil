import type { Canvas, Image, Shader } from '@open-pencil/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { compiledBlender, compiledProgram, fillWithShader } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { defineBlender } from '#core/canvas/sksl'

import coverageSource from './coverage.sksl?raw'
import { NOISE_GRAIN, noiseTileInputs, noiseUniforms } from './shader'
import { noiseColorTile, noiseLevelTile } from './tile'

/** Draws a noise only where, and as much as, the layer under it drew. */
const NOISE_COVERAGE = defineBlender('noise coverage blender', coverageSource)

/** Catmull-Rom as Skia's cubic resampler: B 0, C 0.5, the blend Figma's grains were fitted to. */
const CATMULL_ROM = { B: 0, C: 0.5 }

/** `tile` as a repeating shader in cell units, blended between cells or one value per cell. */
function tileShader(r: SkiaRenderer, tile: Image, blend: boolean): Shader {
  const repeat = r.ck.TileMode.Repeat
  return blend
    ? tile.makeShaderCubic(repeat, repeat, CATMULL_ROM.B, CATMULL_ROM.C)
    : tile.makeShaderOptions(repeat, repeat, r.ck.FilterMode.Nearest, r.ck.MipmapMode.None)
}

/**
 * Draws a layer's content with its noise effects over it, in the order they are listed. As in
 * Figma, a noise grains only what the content draws, as much as it covers each pixel: glyphs and
 * not the text box, strokes as well as fills, a frame's children and not its empty box, and a
 * translucent fill at its own opacity. The content draws into a layer of its own for that, so
 * what lies behind the layer, its shadows included, takes no grain.
 */
export function withNoiseEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  draw: () => void
): void {
  const noises = node.effects.filter((effect) => effect.visible && effect.type === 'NOISE')
  if (noises.length === 0) {
    draw()
    return
  }
  canvas.saveLayer()
  try {
    draw()
    drawNoises(r, canvas, node, graph, noises)
  } finally {
    canvas.restore()
  }
}

function drawNoises(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  noises: readonly Effect[]
): void {
  const output = r.images.supersampledOutput
  const layerToOutput = output
    ? Matrix.multiply(output.outputFromWorld, getWorldMatrix(node, graph))
    : null
  const program = compiledProgram(r.ck, r.shaders, NOISE_GRAIN)
  const paint = r.auxFill
  paint.setBlender(compiledBlender(r.ck, r.shaders, NOISE_COVERAGE))
  try {
    for (const effect of noises) {
      const { shares, seed, blend } = noiseTileInputs(effect)
      const levelTile = noiseLevelTile(r, shares, seed)
      // Only a multitone reads cell colours; the others bind the levels in their place.
      const colorTile =
        effect.noise?.noiseType === 'MULTITONE' ? noiseColorTile(r, seed) : levelTile
      if (!levelTile || !colorTile) continue
      const levels = tileShader(r, levelTile, blend)
      const colors = tileShader(r, colorTile, false)
      const shader = program.effect.makeShaderWithChildren(
        program.uniforms(noiseUniforms(effect, layerToOutput)),
        [levels, colors]
      )
      fillWithShader(canvas, paint, shader)
      shader.delete()
      levels.delete()
      colors.delete()
    }
  } finally {
    paint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}
