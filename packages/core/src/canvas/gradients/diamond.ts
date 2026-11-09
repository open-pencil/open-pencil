import type { InputMatrix, Shader } from '@open-pencil/canvaskit'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledEffect } from '#core/canvas/renderer/shaders'
import { defineShader, programUniforms } from '#core/canvas/sksl'

import diamondSource from './diamond.sksl?raw'

const DIAMOND_GRADIENT = defineShader('diamond gradient', {
  uniforms: {},
  children: ['ramp'],
  body: diamondSource
})

/** Use Skia's ordinary gradient ramp for stop interpolation and color management. */
export function makeDiamondGradient(
  r: SkiaRenderer,
  colors: Float32Array[],
  positions: number[],
  localMatrix: InputMatrix
): Shader {
  const effect = compiledEffect(r.ck, r.shaders, DIAMOND_GRADIENT)
  const ramp = r.ck.Shader.MakeLinearGradient(
    [0, 0],
    [1, 0],
    colors,
    positions,
    r.ck.TileMode.Clamp
  )
  try {
    return effect.makeShaderWithChildren(programUniforms(DIAMOND_GRADIENT, {}), [ramp], localMatrix)
  } finally {
    ramp.delete()
  }
}
