import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { copyStroke } from '@open-pencil/scene-graph/copy'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

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

/** Dashes the layer's strokes: the renderer reads each stroke's pattern, Figma the layer's. */
export function setDashPattern(
  graph: SceneGraph,
  node: SceneNode,
  pattern: readonly number[]
): void {
  graph.updateNode(node.id, {
    dashPattern: [...pattern],
    strokes: node.strokes.map((stroke) => ({ ...copyStroke(stroke), dashPattern: [...pattern] }))
  })
  recordInstanceOverride(graph, node.id, ['strokes', 'dashPattern'])
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
