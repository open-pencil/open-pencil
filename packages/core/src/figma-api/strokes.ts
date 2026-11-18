import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

/**
 * Sets the weight of all of a node's strokes and the weight it keeps with none, as Figma's
 * node-level `strokeWeight` does; the graph gives the strokes the layer's value
 * (`strokeLineChanges`).
 */
export function setStrokeWeight(graph: SceneGraph, node: SceneNode, weight: number): void {
  graph.updateNode(node.id, { strokeWeight: weight })
  recordInstanceOverride(graph, node.id, ['strokeWeight'])
}

/** Sets the alignment of all of a node's strokes and the one it keeps with none. */
export function setStrokeAlign(graph: SceneGraph, node: SceneNode, align: Stroke['align']): void {
  graph.updateNode(node.id, { strokeAlign: align })
  recordInstanceOverride(graph, node.id, ['strokeAlign'])
}

/** Dashes the layer and every stroke on it. */
export function setDashPattern(
  graph: SceneGraph,
  node: SceneNode,
  pattern: readonly number[]
): void {
  graph.updateNode(node.id, { dashPattern: [...pattern] })
  recordInstanceOverride(graph, node.id, ['dashPattern'])
}

export function setIndependentStrokeWeight(
  graph: SceneGraph,
  nodeId: string,
  field: 'borderTopWeight' | 'borderRightWeight' | 'borderBottomWeight' | 'borderLeftWeight',
  value: number
): void {
  const node = graph.getNode(nodeId)
  // Read before the write: the stored node is the object `updateNode` changes.
  const separated = node?.independentStrokeWeights === true
  // The first side set apart keeps the others at the stroke's weight, as in Figma (desktop, live:
  // a 1px stroke given a 20px right side keeps 1px on the other three).
  const others =
    node && !separated
      ? Object.fromEntries(SIDE_FIELDS.map((side) => [side, node.strokeWeight]))
      : {}
  graph.updateNode(nodeId, {
    ...others,
    [field]: value,
    independentStrokeWeights: true
  })
  recordInstanceOverride(graph, nodeId, [
    ...(separated ? [field] : SIDE_FIELDS),
    'independentStrokeWeights'
  ])
}

const SIDE_FIELDS = [
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight'
] as const
