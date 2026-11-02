import type { SceneGraph, SceneNode, Stroke } from '@lawha/scene-graph'
import { compositeOver, readableForeground } from '@lawha/scene-graph/color'
import { WHITE } from '@lawha/scene-graph/constants'
import type { Color } from '@lawha/scene-graph/primitives'

export function canvasLabelForeground(background: Color, canvasBackground: Color = WHITE): Color {
  return readableForeground(compositeOver(background, canvasBackground))
}

/** An outline's colour in the document, its variable's value in the active mode when it has one. */
export function outlineColorInMode(
  graph: SceneGraph,
  node: SceneNode,
  stroke: Stroke,
  index: number
): Color {
  const variableId = node.boundVariables[`strokes/${index}/color`]
  return (variableId && graph.resolveColorVariableForNode(node.id, variableId)) || stroke.color
}
