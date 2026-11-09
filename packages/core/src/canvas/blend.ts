import type { BlendMode as SkBlendMode, CanvasKit, Paint } from '@open-pencil/canvaskit'
import type { BlendMode } from '@open-pencil/scene-graph'

import { compiledBlender } from '#core/canvas/renderer/shaders'
import { defineBlender, sksl } from '#core/canvas/sksl'

import type { SkiaRenderer } from './renderer'

type LinearBlendMode = 'LINEAR_BURN' | 'LINEAR_DODGE'

/**
 * Figma's plus darker and plus lighter, in premultiplied sRGB with source-over coverage: the sum
 * less the overlap clamped at zero, and the sum clamped at the coverage (live-measured).
 */
const LINEAR_BLEND_COLORS: Record<LinearBlendMode, string> = {
  LINEAR_BURN: 'max(src.rgb + dst.rgb - src.a * dst.a, half3(0))',
  LINEAR_DODGE: 'min(src.rgb + dst.rgb, half3(alpha))'
}

function linearBlender(mode: LinearBlendMode) {
  return defineBlender(mode === 'LINEAR_BURN' ? 'plus darker blender' : 'plus lighter blender', {
    uniforms: {},
    body: sksl`
      half4 main(half4 src, half4 dst) {
        half alpha = src.a + dst.a * (1 - src.a);
        return half4(${LINEAR_BLEND_COLORS[mode]}, alpha);
      }
    `
  })
}

/** Skia has no blend mode for either: they are runtime blenders. */
const LINEAR_BLENDERS = {
  LINEAR_BURN: linearBlender('LINEAR_BURN'),
  LINEAR_DODGE: linearBlender('LINEAR_DODGE')
}

export function figmaBlendModeToSkia(
  ck: CanvasKit,
  mode?: Exclude<BlendMode, LinearBlendMode>
): SkBlendMode {
  switch (mode) {
    case 'DARKEN':
      return ck.BlendMode.Darken
    case 'MULTIPLY':
      return ck.BlendMode.Multiply
    case 'COLOR_BURN':
      return ck.BlendMode.ColorBurn
    case 'LIGHTEN':
      return ck.BlendMode.Lighten
    case 'SCREEN':
      return ck.BlendMode.Screen
    case 'COLOR_DODGE':
      return ck.BlendMode.ColorDodge
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
    paint.setBlender(compiledBlender(r.ck, r.shaders, LINEAR_BLENDERS[mode]))
    return
  }
  paint.setBlendMode(figmaBlendModeToSkia(r.ck, mode))
}

export function needsIsolatedBlendLayer(mode?: BlendMode): boolean {
  return mode !== undefined && mode !== 'NORMAL' && mode !== 'PASS_THROUGH'
}
