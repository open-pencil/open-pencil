import type { InputMatrix, Shader } from '@open-pencil/canvaskit'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledProgram } from '#core/canvas/renderer/shaders'
import { defineShader } from '#core/canvas/sksl'

import diamondSource from './diamond.sksl?raw'

const DIAMOND_GRADIENT = defineShader('diamond gradient', diamondSource)

/** Use Skia's ordinary gradient ramp for stop interpolation and color management. */
export function makeDiamondGradient(
  r: SkiaRenderer,
  colors: Float32Array[],
  positions: number[],
  localMatrix: InputMatrix
): Shader {
  const diamond = compiledProgram(r.ck, r.shaders, DIAMOND_GRADIENT)
  const ramp = r.ck.Shader.MakeLinearGradient(
    [0, 0],
    [1, 0],
    colors,
    positions,
    r.ck.TileMode.Clamp
  )
  try {
    return diamond.effect.makeShaderWithChildren(diamond.uniforms({}), [ramp], localMatrix)
  } finally {
    ramp.delete()
  }
}
