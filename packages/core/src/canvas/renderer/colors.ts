import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import {
  resolveNodeFillColor,
  resolveNodeStrokeColor,
  resolveRGBAForPreview,
  type RenderColorSpace,
  type ResolvedRenderColor,
  normalizeColor,
  getFillOkHCL,
  getStrokeOkHCL
} from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/**
 * A bound paint draws the color it stores, which its variable last wrote into it, as Figma draws
 * it; OkHCL data kept from before it was bound no longer describes it.
 */
function isBound(node: SceneNode, list: 'fills' | 'strokes', index: number): boolean {
  return `${list}/${index}/color` in node.boundVariables
}

export function resolveFillColorInfo(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): ResolvedRenderColor {
  const options = { documentColorSpace: graph.documentColorSpace, colorSpace: presentation }
  if (isBound(node, 'fills', fillIndex)) return resolveRGBAForPreview(fill.color, options)
  return resolveNodeFillColor(fill, fillIndex, node, options)
}

export function resolveFillColor(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): Color {
  if (isBound(node, 'fills', fillIndex) || !getFillOkHCL(node, fillIndex))
    return normalizeColor(fill.color)
  return resolveFillColorInfo(fill, fillIndex, node, graph, presentation).color
}

/**
 * A gradient stop's color as drawn. Bindings and OkHCL data belong to a solid paint's one color, so
 * a stop only goes through color management, whatever paint list or index its gradient sits at.
 */
export function resolveGradientStopColor(
  color: Color,
  graph: SceneGraph,
  presentation: RenderColorSpace
): Color {
  return resolveRGBAForPreview(color, {
    documentColorSpace: graph.documentColorSpace,
    colorSpace: presentation
  }).color
}

export function resolveStrokeColorInfo(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): ResolvedRenderColor {
  const options = { documentColorSpace: graph.documentColorSpace, colorSpace: presentation }
  if (isBound(node, 'strokes', strokeIndex)) return resolveRGBAForPreview(stroke.color, options)
  return resolveNodeStrokeColor(stroke, strokeIndex, node, options)
}

export function resolveStrokeColor(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): Color {
  if (isBound(node, 'strokes', strokeIndex) || !getStrokeOkHCL(node, strokeIndex))
    return normalizeColor(stroke.color)
  return resolveStrokeColorInfo(stroke, strokeIndex, node, graph, presentation).color
}
