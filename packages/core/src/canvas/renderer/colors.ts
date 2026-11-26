import type { CanvasKit, ColorSpace, ColorType, ImageInfo } from '@open-pencil/canvaskit'
import type { ColorProfile, SceneGraph } from '@open-pencil/scene-graph'
import { normalizeColor, toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** Skia's color space for a document's. */
export function skColorSpace(ck: CanvasKit, space: ColorProfile): ColorSpace {
  return space === 'display-p3' ? ck.ColorSpace.DISPLAY_P3 : ck.ColorSpace.SRGB
}

/**
 * A premultiplied surface `width` by `height` in `profile`, as a document is drawn on: its colors
 * and blend modes work in its own profile there, as on the screen and in Figma's export.
 */
export function documentImageInfo(
  ck: CanvasKit,
  profile: ColorProfile,
  width: number,
  height: number,
  colorType: ColorType = ck.ColorType.RGBA_8888
): ImageInfo {
  return {
    width,
    height,
    colorType,
    alphaType: ck.AlphaType.Premul,
    colorSpace: skColorSpace(ck, profile)
  }
}

/**
 * A stored color, such as a paint's or a gradient stop's, as Skia is given it: its components, in
 * the document's profile, as extended sRGB, which Skia converts into the document's space of the
 * surfaces it draws on. The stored color is what draws, as in Figma; an OkHCL value kept for
 * editing only describes it.
 */
export function drawnColor(color: Color, graph: SceneGraph): Color {
  return toExtendedSRGB(normalizeColor(color), graph.documentColorSpace)
}
