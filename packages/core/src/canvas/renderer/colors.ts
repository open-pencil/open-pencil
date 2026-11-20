import type { CanvasKit, ColorSpace } from '@open-pencil/canvaskit'
import type { ColorProfile, Fill, SceneGraph, Stroke } from '@open-pencil/scene-graph'
import { normalizeColor, toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** Skia's color space for a document's. */
export function skColorSpace(ck: CanvasKit, space: ColorProfile): ColorSpace {
  return space === 'display-p3' ? ck.ColorSpace.DISPLAY_P3 : ck.ColorSpace.SRGB
}

/**
 * A paint's color as Skia is given it: its stored components, in the document's profile, as
 * extended sRGB, which Skia converts into the document's space of the surfaces it draws on. The
 * stored color is what draws, as in Figma; an OkHCL value kept for editing only describes it.
 */
export function resolveFillColor(fill: Fill, graph: SceneGraph): Color {
  return toExtendedSRGB(normalizeColor(fill.color), graph.documentColorSpace)
}

/** A gradient stop's color as drawn, as {@link resolveFillColor} gives a paint's. */
export function resolveGradientStopColor(color: Color, graph: SceneGraph): Color {
  return toExtendedSRGB(normalizeColor(color), graph.documentColorSpace)
}

/** A stroke's color as drawn, as {@link resolveFillColor} gives a fill's. */
export function resolveStrokeColor(stroke: Stroke, graph: SceneGraph): Color {
  return toExtendedSRGB(normalizeColor(stroke.color), graph.documentColorSpace)
}
