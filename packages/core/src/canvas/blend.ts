import type { Blender, BlendMode as SkBlendMode, CanvasKit, Paint } from 'canvaskit-wasm'

import type { BlendMode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from './renderer'

type LinearBlendMode = 'LINEAR_BURN' | 'LINEAR_DODGE'

const LINEAR_BLEND_TERMS: Record<LinearBlendMode, string> = {
  LINEAR_BURN: 'max(src.rgb * dst.a + dst.rgb * src.a - src.a * dst.a, half3(0))',
  LINEAR_DODGE: 'min(src.rgb * dst.a + dst.rgb * src.a, half3(src.a * dst.a))'
}

function separableBlender(blended: string): string {
  return `half4 main(half4 src, half4 dst) {
  half3 blended = ${blended};
  return half4(src.rgb * (1 - dst.a) + dst.rgb * (1 - src.a) + blended, src.a + dst.a * (1 - src.a));
}`
}

export function figmaBlendModeToSkia(ck: CanvasKit, mode?: BlendMode): SkBlendMode {
  switch (mode) {
    case 'DARKEN':
      return ck.BlendMode.Darken
    case 'MULTIPLY':
      return ck.BlendMode.Multiply
    case 'COLOR_BURN':
    case 'LINEAR_BURN':
      return ck.BlendMode.ColorBurn
    case 'LIGHTEN':
      return ck.BlendMode.Lighten
    case 'SCREEN':
      return ck.BlendMode.Screen
    case 'COLOR_DODGE':
      return ck.BlendMode.ColorDodge
    case 'LINEAR_DODGE':
      return ck.BlendMode.Plus
    case 'OVERLAY':
      return ck.BlendMode.Overlay
    case 'SOFT_LIGHT':
      return ck.BlendMode.SoftLight
    case 'HARD_LIGHT':
      return ck.BlendMode.HardLight
    case 'DIFFERENCE':
      return ck.BlendMode.Difference
    case 'EXCLUSION':
      return ck.BlendMode.Exclusion
    case 'HUE':
      return ck.BlendMode.Hue
    case 'SATURATION':
      return ck.BlendMode.Saturation
    case 'COLOR':
      return ck.BlendMode.Color
    case 'LUMINOSITY':
      return ck.BlendMode.Luminosity
    default:
      return ck.BlendMode.SrcOver
  }
}

export function setPaintBlendMode(r: SkiaRenderer, paint: Paint, mode?: BlendMode): void {
  if (mode === 'LINEAR_BURN' || mode === 'LINEAR_DODGE') {
    paint.setBlender(linearBlender(r, mode))
    return
  }
  paint.setBlendMode(figmaBlendModeToSkia(r.ck, mode))
}

function linearBlender(r: SkiaRenderer, mode: LinearBlendMode): Blender {
  const cached = mode === 'LINEAR_BURN' ? r.linearBurnBlender : r.linearDodgeBlender
  if (cached) {
    return cached
  }
  const blender = compileLinearBlender(r, mode)
  if (mode === 'LINEAR_BURN') {
    r.linearBurnBlender = blender
  } else {
    r.linearDodgeBlender = blender
  }
  return blender
}

function compileLinearBlender(r: SkiaRenderer, mode: LinearBlendMode): Blender {
  let error = ''
  const effect = r.ck.RuntimeEffect.MakeForBlender(
    separableBlender(LINEAR_BLEND_TERMS[mode]),
    (message) => {
      error = message
    }
  )
  if (!effect) {
    throw new Error(`Cannot compile ${mode} blender: ${error}`)
  }
  const blender = effect.makeBlender([])
  effect.delete()
  return blender
}

export function needsIsolatedBlendLayer(mode?: BlendMode): boolean {
  return mode !== undefined && mode !== 'NORMAL' && mode !== 'PASS_THROUGH'
}
