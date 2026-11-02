import type { InputMatrix, Shader } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledEffect } from '#core/canvas/renderer/shaders'

const DIAMOND_GRADIENT = `
uniform shader ramp;
half4 main(float2 position) {
  float2 distance = abs(position - float2(0.5));
  return ramp.eval(float2(2.0 * (distance.x + distance.y), 0.0));
}
`

/** Use Skia's ordinary gradient ramp for stop interpolation and color management. */
export function makeDiamondGradient(
  r: SkiaRenderer,
  colors: Float32Array[],
  positions: number[],
  localMatrix: InputMatrix
): Shader {
  const effect = compiledEffect(
    r.ck,
    r.shaders,
    'diamondGradient',
    DIAMOND_GRADIENT,
    'diamond gradient'
  )
  const ramp = r.ck.Shader.MakeLinearGradient(
    [0, 0],
    [1, 0],
    colors,
    positions,
    r.ck.TileMode.Clamp
  )
  try {
    return effect.makeShaderWithChildren([], [ramp], localMatrix)
  } finally {
    ramp.delete()
  }
}
