import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { compositeOver, readableForeground } from '@open-pencil/scene-graph/color'
import { WHITE } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

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
