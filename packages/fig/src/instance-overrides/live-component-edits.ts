import {
  getInstanceOverride,
  INSTANCE_SYNC_FIELDS,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { MaterializedInstance } from './materialize-instance'

/** Apply live component edits to new occurrences, never repaint or resync existing pages. */
export function reconcileLiveComponentEdits(
  graph: SceneGraph,
  materialized: MaterializedInstance
): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const target of materialized.nodes.values()) {
      const owners: SceneNode[] = []
      let parent = target.parentId ? graph.getNode(target.parentId) : undefined
      while (parent) {
        if (parent.type === 'INSTANCE') owners.push(parent)
        parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
      }
      if (target.type === 'INSTANCE') owners.unshift(target)
      const protectedFields = new Set<string>()
      for (const owner of owners) {
        const fields =
          owner.id === target.id
            ? owner.instanceOverrides.self
            : owner.instanceOverrides.descendants.get(target.id)
        for (const field of fields?.keys() ?? []) protectedFields.add(field)
      }
      const updates: Partial<SceneNode> = {}
      for (const owner of owners) {
        const mapped = getInstanceOverride(
          owner.instanceOverrides,
          owner.id,
          target.id,
          'sourceComponentId'
        )
        const sourceId = typeof mapped === 'string' ? mapped : target.componentId
        const source = sourceId ? graph.getNode(sourceId) : undefined
        if (!source) continue
        for (const field of INSTANCE_SYNC_FIELDS) {
          if (!source.source.editedFields.includes(field) || protectedFields.has(field)) continue
          Object.assign(updates, { [field]: structuredClone(source[field]) })
        }
      }
      if (Object.keys(updates).length) graph.updateNode(target.id, updates)
    }
  })
}
