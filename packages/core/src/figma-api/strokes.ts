import { recordInstanceOverride } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { copyStroke } from '@open-pencil/scene-graph/copy'

/**
 * Sets the weight of all of a node's strokes and the weight it keeps with none, as Figma's
 * node-level `strokeWeight` does; see `SceneNode.strokeWeight`.
 */
export function setStrokeWeight(graph: SceneGraph, node: SceneNode, weight: number): void {
  graph.updateNode(node.id, {
    strokeWeight: weight,
    strokes: node.strokes.map((stroke) => ({ ...copyStroke(stroke), weight }))
  })
  recordInstanceOverride(graph, node.id, ['strokes', 'strokeWeight'])
}

/** Sets the alignment of all of a node's strokes and the one it keeps with none. */
export function setStrokeAlign(graph: SceneGraph, node: SceneNode, align: Stroke['align']): void {
  graph.updateNode(node.id, {
    strokeAlign: align,
    strokes: node.strokes.map((stroke) => ({ ...copyStroke(stroke), align }))
  })
  recordInstanceOverride(graph, node.id, ['strokes', 'strokeAlign'])
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
  recordInstanceOverride(graph, nodeId, [field, 'independentStrokeWeights'])
}
