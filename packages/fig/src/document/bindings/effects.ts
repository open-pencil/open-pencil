import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { resolvedEffectBindings } from '@open-pencil/scene-graph/variables'

/**
 * Resolve bound effect values once hierarchy and modes exist: a file saves the default mode's
 * values even on a layer set to another mode, and Figma resolves them again on open.
 */
export function applyDocumentEffectBindings(
  graph: SceneGraph,
  materialized: readonly SceneNode[]
): void {
  for (const node of materialized) {
    const changes = resolvedEffectBindings(graph, node)
    if (changes.effects) graph.updateNode(node.id, changes)
  }
}
