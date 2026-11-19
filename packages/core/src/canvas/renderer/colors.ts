import type { CanvasKit, ColorSpace } from '@open-pencil/canvaskit'
import type {
  DocumentColorSpace,
  Fill,
  SceneGraph,
  SceneNode,
  Stroke
} from '@open-pencil/scene-graph'
import {
  normalizeColor,
  resolveNodeFillColor,
  resolveNodeStrokeColor,
  toExtendedSRGB
} from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** Skia's color space for a document's. */
export function skColorSpace(ck: CanvasKit, space: DocumentColorSpace): ColorSpace {
  return space === 'display-p3' ? ck.ColorSpace.DISPLAY_P3 : ck.ColorSpace.SRGB
}

/**
 * A bound paint draws the color it stores, which its variable last wrote into it, as Figma draws
 * it; OkHCL data kept from before it was bound no longer describes it.
 */
function isBound(node: SceneNode, list: 'fills' | 'strokes', index: number): boolean {
  return `${list}/${index}/color` in node.boundVariables
}

/**
 * A solid fill's color as Skia is given it, its OkHCL color fitted to the document's gamut: in
 * extended sRGB, which Skia converts into the document's space of the surfaces it draws on.
 */
export function resolveFillColor(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph
): Color {
  const space = graph.documentColorSpace
  const color = isBound(node, 'fills', fillIndex)
    ? normalizeColor(fill.color)
    : resolveNodeFillColor(fill, fillIndex, node, { documentColorSpace: space }).color
  return toExtendedSRGB(color, space)
}

/**
 * A gradient stop's color as drawn. Bindings and OkHCL data belong to a solid paint's one color, so
 * a stop only goes through color management, whatever paint list or index its gradient sits at.
 */
export function resolveGradientStopColor(color: Color, graph: SceneGraph): Color {
  return toExtendedSRGB(normalizeColor(color), graph.documentColorSpace)
}

/** A stroke's color as drawn, its OkHCL color fitted to the document's gamut. */
export function resolveStrokeColor(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph
): Color {
  const space = graph.documentColorSpace
  const color = isBound(node, 'strokes', strokeIndex)
    ? normalizeColor(stroke.color)
    : resolveNodeStrokeColor(stroke, strokeIndex, node, { documentColorSpace: space }).color
  return toExtendedSRGB(color, space)
}
