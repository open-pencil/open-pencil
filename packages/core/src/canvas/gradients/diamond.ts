import type { InputMatrix, Shader } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

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
  if (!r.shaders.diamondGradient) {
    let error = ''
    const effect = r.ck.RuntimeEffect.Make(DIAMOND_GRADIENT, (message) => {
      error = message
    })
    if (!effect) throw new Error(`Cannot compile diamond gradient: ${error}`)
    r.shaders.diamondGradient = effect
  }
  const ramp = r.ck.Shader.MakeLinearGradient(
    [0, 0],
    [1, 0],
    colors,
    positions,
    r.ck.TileMode.Clamp
  )
  try {
    return r.shaders.diamondGradient.makeShaderWithChildren([], [ramp], localMatrix)
  } finally {
    ramp.delete()
  }
}
