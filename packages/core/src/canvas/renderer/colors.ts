import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  resolveNodeFillColor,
  resolveNodeStrokeColor,
  resolveRGBAForPreview
} from '#core/color/management'
import type { RenderColorSpace, ResolvedRenderColor } from '#core/color/management'
import { normalizeColor } from '#core/color/normalize'
import { getFillOkHCL, getStrokeOkHCL } from '#core/color/okhcl'

function resolvedVariableColor(
  color: Color,
  graph: SceneGraph,
  presentation: RenderColorSpace
): ResolvedRenderColor {
  return {
    ...resolveRGBAForPreview(color, {
      documentColorSpace: graph.documentColorSpace,
      colorSpace: presentation
    }),
    cssColor: ''
  }
}

export function resolveFillColorInfo(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): ResolvedRenderColor {
  const varId = node.boundVariables[`fills/${fillIndex}/color`]
  if (varId) {
    const resolved = graph.resolveColorVariableForNode(node.id, varId)
    if (resolved) return resolvedVariableColor(resolved, graph, presentation)
  }
  return resolveNodeFillColor(fill, fillIndex, node, {
    documentColorSpace: graph.documentColorSpace,
    colorSpace: presentation
  })
}

export function resolveFillColor(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): Color {
  const varId = node.boundVariables[`fills/${fillIndex}/color`]
  if (!varId && !getFillOkHCL(node, fillIndex)) return normalizeColor(fill.color)
  return resolveFillColorInfo(fill, fillIndex, node, graph, presentation).color
}

export function resolveStrokeColorInfo(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): ResolvedRenderColor {
  const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
  if (varId) {
    const resolved = graph.resolveColorVariableForNode(node.id, varId)
    if (resolved) return resolvedVariableColor(resolved, graph, presentation)
  }
  return resolveNodeStrokeColor(stroke, strokeIndex, node, {
    documentColorSpace: graph.documentColorSpace,
    colorSpace: presentation
  })
}

export function resolveStrokeColor(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph,
  presentation: RenderColorSpace
): Color {
  const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
  if (!varId && !getStrokeOkHCL(node, strokeIndex)) return normalizeColor(stroke.color)
  return resolveStrokeColorInfo(stroke, strokeIndex, node, graph, presentation).color
}
