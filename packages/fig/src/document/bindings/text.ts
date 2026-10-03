import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/**
 * Resolve text bound to a string variable once occurrence hierarchy and modes exist. Read
 * time is the only time: unlike a numeric binding, nothing re-resolves a string one when the
 * variable or the node's mode changes later, so edited text goes stale until the next read.
 * Figma stores a bound layer's resolved characters, but an instance override carries the
 * binding alone, and a literal override of a bound layer is retired rather than applied —
 * so the binding, not the claim, decides what a bound layer reads.
 */
export function applyDocumentTextBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  for (const node of materialized) {
    if (node.type !== 'TEXT') continue
    const variableId = node.boundVariables.text
    if (!variableId) continue
    const text = graph.resolveStringVariableForNode(node.id, variableId)
    if (text === undefined || text === node.text) continue
    graph.updateNode(node.id, { text })
  }
}
