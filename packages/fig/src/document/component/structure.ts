import type { MaterializedComponentOccurrence } from '#fig/instance-overrides/source-children'

import type { SceneGraph } from '@open-pencil/scene-graph'

/** Structural reconciliation is not implemented: reject divergence before page mutation. */
export function assertComponentStructureCurrent(
  graph: SceneGraph,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>
): void {
  for (const [sourceId, component] of components) {
    for (const [occurrence, snapshotNode] of component.materialized.nodes) {
      const node = graph.getNode(snapshotNode.id)
      const expected = occurrence.children.map(
        (child) => component.materialized.nodes.get(child)?.id
      )
      if (
        !node ||
        expected.length !== node.childIds.length ||
        expected.some((id, index) => id !== node.childIds[index])
      ) {
        throw new Error(
          `Component structure changed since import: ${sourceId}; page loading requires structural reconciliation`
        )
      }
    }
  }
}
