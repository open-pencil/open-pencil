import { resolveNodeFillColor, resolveNodeStrokeColor } from '#core/color/management'
import type { ResolvedRenderColor } from '#core/color/management'
import { normalizeColor } from '#core/color/normalize'
import { getFillOkHCL, getStrokeOkHCL } from '#core/color/okhcl'
import type { Fill, SceneGraph, SceneNode, Stroke } from '#core/scene-graph'
import type { Color } from '#core/types'

function resolvedVariableColor(color: Color, graph: SceneGraph): ResolvedRenderColor {
  return {
    color,
    cssColor: '',
    sourceSpace: 'srgb',
    targetSpace: graph.documentColorSpace,
    clipped: false
  }
}

export function resolveFillColorInfo(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph
): ResolvedRenderColor {
  const varId = node.boundVariables[`fills/${fillIndex}/color`]
  if (varId) {
    const resolved = graph.resolveColorVariable(varId)
    if (resolved) return resolvedVariableColor(resolved, graph)
  }
  return resolveNodeFillColor(fill, fillIndex, node, {
    documentColorSpace: graph.documentColorSpace
  })
}

export function resolveFillColor(
  fill: Fill,
  fillIndex: number,
  node: SceneNode,
  graph: SceneGraph
): Color {
  const varId = node.boundVariables[`fills/${fillIndex}/color`]
  if (!varId && !getFillOkHCL(node, fillIndex)) return normalizeColor(fill.color)
  return resolveFillColorInfo(fill, fillIndex, node, graph).color
}

export function resolveStrokeColorInfo(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph
): ResolvedRenderColor {
  const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
  if (varId) {
    const resolved = graph.resolveColorVariable(varId)
    if (resolved) return resolvedVariableColor(resolved, graph)
  }
  return resolveNodeStrokeColor(stroke, strokeIndex, node, {
    documentColorSpace: graph.documentColorSpace
  })
}

export function resolveStrokeColor(
  stroke: Stroke,
  strokeIndex: number,
  node: SceneNode,
  graph: SceneGraph
): Color {
  const varId = node.boundVariables[`strokes/${strokeIndex}/color`]
  if (!varId && !getStrokeOkHCL(node, strokeIndex)) return normalizeColor(stroke.color)
  return resolveStrokeColorInfo(stroke, strokeIndex, node, graph).color
}
