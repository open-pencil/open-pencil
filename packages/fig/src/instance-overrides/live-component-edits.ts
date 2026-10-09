import {
  INSTANCE_SYNC_FIELDS,
  instanceLayerLineage,
  overriddenFields,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { MaterializedInstance } from './materialize-instance'

/**
 * The layers `target` takes its values from, nearest first: the component layers a copy derives
 * from, then the component an instance shows.
 */
export function syncSourceLayers(graph: SceneGraph, target: SceneNode): SceneNode[] {
  const lineage = instanceLayerLineage(graph, target)
  const instance = [target, ...lineage].findLast((node) => node.type === 'INSTANCE')
  const component = instance?.componentId ? graph.getNode(instance.componentId) : undefined
  return component && !lineage.includes(component) ? [...lineage, component] : lineage
}

/** Apply live component edits to new occurrences, never repaint or resync existing pages. */
export function reconcileLiveComponentEdits(
  graph: SceneGraph,
  materialized: MaterializedInstance
): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const target of materialized.nodes.values()) {
      const protectedFields = overriddenFields(graph, target)
      const updates: Partial<SceneNode> = {}
      for (const source of syncSourceLayers(graph, target).toReversed()) {
        for (const field of INSTANCE_SYNC_FIELDS) {
          if (!source.source.editedFields.includes(field) || protectedFields.has(field)) continue
          Object.assign(updates, { [field]: structuredClone(source[field]) })
        }
      }
      if (Object.keys(updates).length) graph.updateNode(target.id, updates)
    }
  })
}
