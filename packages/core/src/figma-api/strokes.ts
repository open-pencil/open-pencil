import type { SceneGraph, SceneNode, Stroke } from '#core/scene-graph'
import { copyStrokes } from '#core/scene-graph/copy'

export function setFirstStrokeWeight(graph: SceneGraph, node: SceneNode, weight: number): void {
  if (node.strokes.length === 0) return
  const strokes = copyStrokes(node.strokes)
  strokes[0].weight = weight
  graph.updateNode(node.id, { strokes })
}

export function setFirstStrokeAlign(graph: SceneGraph, node: SceneNode, align: string): void {
  if (node.strokes.length === 0) return
  const strokes = copyStrokes(node.strokes)
  strokes[0].align = align as Stroke['align']
  graph.updateNode(node.id, { strokes })
}

export function setIndependentStrokeWeight(
  graph: SceneGraph,
  nodeId: string,
  field: 'borderTopWeight' | 'borderRightWeight' | 'borderBottomWeight' | 'borderLeftWeight',
  value: number
): void {
  graph.updateNode(nodeId, {
    [field]: value,
    independentStrokeWeights: true
  })
}
