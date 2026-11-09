import type { BlendMode as SkBlendMode, CanvasKit, Paint } from '@open-pencil/canvaskit'
import type { BlendMode } from '@open-pencil/scene-graph'

import { compiledBlender } from '#core/canvas/renderer/shaders'
import { defineBlender, type SkslProgram } from '#core/canvas/sksl'

import plusDarkerSource from './blenders/plus-darker.sksl?raw'
import plusLighterSource from './blenders/plus-lighter.sksl?raw'
import type { SkiaRenderer } from './renderer'

type LinearBlendMode = 'LINEAR_BURN' | 'LINEAR_DODGE'

/** Figma's plus darker and plus lighter: Skia has no blend mode for either. */
const LINEAR_BLENDERS: Record<LinearBlendMode, SkslProgram<Record<string, never>>> = {
  LINEAR_BURN: defineBlender('plus darker blender', { uniforms: {}, body: plusDarkerSource }),
  LINEAR_DODGE: defineBlender('plus lighter blender', { uniforms: {}, body: plusLighterSource })
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
