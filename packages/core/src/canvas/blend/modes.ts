import type { BlendMode as SkBlendMode, Canvas, CanvasKit, Paint } from '@open-pencil/canvaskit'
import type { BlendMode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { compiledBlender, keptBlender } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { defineBlender, type NoUniforms, type SkslProgram } from '#core/canvas/sksl'
import { ZOOM_MIN } from '#core/constants'

import fadeOverBackdropSource from './fade-over-backdrop.sksl?raw'
import plusDarkerSource from './plus-darker.sksl?raw'
import plusLighterSource from './plus-lighter.sksl?raw'

type LinearBlendMode = 'LINEAR_BURN' | 'LINEAR_DODGE'

/** Figma's plus darker and plus lighter: Skia has no blend mode for either. */
const LINEAR_BLENDERS: Record<LinearBlendMode, SkslProgram<NoUniforms>> = {
  LINEAR_BURN: defineBlender('plus darker blender', plusDarkerSource),
  LINEAR_DODGE: defineBlender('plus lighter blender', plusLighterSource)
}

const FADE_OVER_BACKDROP = defineBlender<{ opacity: number }>(
  'fade over backdrop blender',
  fadeOverBackdropSource
)

function isLinearBlendMode(mode?: BlendMode): mode is LinearBlendMode {
  return mode === 'LINEAR_BURN' || mode === 'LINEAR_DODGE'
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
  if (isLinearBlendMode(mode)) {
    paint.setBlender(compiledBlender(r.ck, r.shaders, LINEAR_BLENDERS[mode]))
    return
  }
  paint.setBlendMode(figmaBlendModeToSkia(r.ck, mode))
}

const SMALLEST_REPLAY_SCALE = ZOOM_MIN
const DIRECT_DRAW_MARGIN_PIXELS = 2

// Skia restores a runtime-blender layer over the whole clip, though ours keep transparent pixels.
function clipToLayerBounds(r: SkiaRenderer, canvas: Canvas, bounds: Float32Array): void {
  const margin = layerClipMargin(r, canvas, bounds)
  if (!margin) {
    return
  }
  const [left, top, right, bottom] = bounds
  const grown = r.ck.LTRBRect(left - margin.x, top - margin.y, right + margin.x, bottom + margin.y)
  canvas.clipRect(grown, r.ck.ClipOp.Intersect, true)
}

function layerClipMargin(r: SkiaRenderer, canvas: Canvas, bounds: Float32Array): Vector | null {
  const matrix = canvas.getTotalMatrix()
  const pixel = { x: 1 / Math.hypot(matrix[0], matrix[3]), y: 1 / Math.hypot(matrix[1], matrix[4]) }
  if (!Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) {
    return null
  }
  if (r.recordingPictures === 0) {
    return { x: pixel.x * DIRECT_DRAW_MARGIN_PIXELS, y: pixel.y * DIRECT_DRAW_MARGIN_PIXELS }
  }
  const [left, top, right, bottom] = bounds
  const layerSize = Math.max(right - left, bottom - top)
  const replayMargin = (devicePixel: number) =>
    Math.max(devicePixel, Math.min(devicePixel / SMALLEST_REPLAY_SCALE, layerSize))
  return { x: replayMargin(pixel.x), y: replayMargin(pixel.y) }
}

export function saveBlendedLayer(
  r: SkiaRenderer,
  canvas: Canvas,
  paint: Paint,
  mode: BlendMode | undefined,
  bounds: Float32Array | null
): void {
  setPaintBlendMode(r, paint, mode)
  canvas.save()
  if (bounds && isLinearBlendMode(mode)) {
    clipToLayerBounds(r, canvas, bounds)
  }
  canvas.saveLayer(paint, bounds)
}

export function saveLayerOverBackdrop(
  r: SkiaRenderer,
  canvas: Canvas,
  paint: Paint,
  opacity: number,
  bounds: Float32Array | null,
  backdropReach = 0
): void {
  paint.setAlphaf(opacity)
  // Mixed back by opacity rather than source-over, which would count a translucent backdrop twice.
  paint.setBlender(keptBlender(r.ck, r.shaders, FADE_OVER_BACKDROP, { opacity }))
  canvas.save()
  const layerBounds = bounds && grownBounds(r, bounds, backdropReach)
  if (layerBounds) {
    clipToLayerBounds(r, canvas, layerBounds)
  }
  canvas.saveLayer(paint, layerBounds, null, r.ck.SaveLayerInitWithPrevious)
}

function grownBounds(r: SkiaRenderer, bounds: Float32Array, by: number): Float32Array {
  if (by <= 0) {
    return bounds
  }
  const [left, top, right, bottom] = bounds
  return r.ck.LTRBRect(left - by, top - by, right + by, bottom + by)
}

export function restoreBlendedLayer(canvas: Canvas): void {
  canvas.restore()
  canvas.restore()
}

export function needsIsolatedBlendLayer(mode?: BlendMode): boolean {
  return mode !== undefined && mode !== 'NORMAL' && mode !== 'PASS_THROUGH'
}
