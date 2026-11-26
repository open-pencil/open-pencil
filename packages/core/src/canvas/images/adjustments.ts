/**
 * An image paint's adjustments as a Skia runtime shader over the image, matched to Figma's
 * exports pixel for pixel (within one level of 8 bits). Each pixel, unpremultiplied and in
 * gamma 2.2 light, goes through three steps in Figma's order:
 *
 * 1. Temperature, tint, and contrast in CIELab: a* and b* shift, and contrast moves L*.
 * 2. Exposure, highlights, and shadows in one pass: a Reinhard-type curve per channel whose
 *    strength is exposure plus highlights and shadows weighed by the pixel's original luminance.
 * 3. Saturation, scaling the colour's distance from its luminance.
 */

import type { Shader } from '@open-pencil/canvaskit'
import type { ImageFilters } from '@open-pencil/scene-graph'

import { compiledProgram } from '#core/canvas/renderer/shaders'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { defineShader } from '#core/canvas/sksl'

import adjustmentsSource from './adjustments.sksl?raw'

type Adjustments = Required<ImageFilters>

const IMAGE_ADJUSTMENTS = defineShader<Adjustments>('image adjustments', adjustmentsSource)

/** Whether `filters` changes any pixel. */
export function hasImageAdjustments(filters: ImageFilters | undefined): filters is ImageFilters {
  return !!filters && Object.values(filters).some((value) => value !== undefined && value !== 0)
}

/** `image` with `filters` applied to every pixel; the caller deletes both shaders. */
export function makeAdjustedImageShader(
  r: SkiaRenderer,
  image: Shader,
  filters: ImageFilters
): Shader {
  const program = compiledProgram(r.ck, r.shaders, IMAGE_ADJUSTMENTS)
  return program.effect.makeShaderWithChildren(
    program.uniforms({
      exposure: filters.exposure ?? 0,
      contrast: filters.contrast ?? 0,
      saturation: filters.saturation ?? 0,
      temperature: filters.temperature ?? 0,
      tint: filters.tint ?? 0,
      highlights: filters.highlights ?? 0,
      shadows: filters.shadows ?? 0
    }),
    [image]
  )
}
