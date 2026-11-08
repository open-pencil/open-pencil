import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  createSceneMutationImpact,
  recordSceneMutations
} from '@open-pencil/scene-graph/mutation-impact'

import { syncComponentsHolding } from '#core/editor/components/sync'

const syncByGraph = new WeakMap<SceneGraph, () => void>()

/**
 * Makes reading a layer bring instances in line with the component edits made before it, as Figma
 * does at once: a script that recolors a component and then reads an instance sees the new color.
 * A host that already syncs instances after edits, such as the editor, passes its own `flush`,
 * which also lays out and redraws what it synced. Without one the graph records its edits itself,
 * for its lifetime, as `startPendingLayout` does.
 */
export function startPendingComponentSync(graph: SceneGraph, flush?: () => void): void {
  if (flush) {
    syncByGraph.set(graph, flush)
    return
  }
  if (syncByGraph.has(graph)) return
  const impact = createSceneMutationImpact()
  let syncing = false
  // Syncing writes the instances it updates, which are results, not edits; so do loading and layout.
  recordSceneMutations(
    graph,
    impact,
    () => !syncing && !graph.isApplyingImportedState && !graph.isApplyingLayout
  )
  syncByGraph.set(graph, () => {
    if (syncing || impact.changedNodeIds.size === 0) return
    const ids = [...impact.changedNodeIds, ...impact.previousParentIds]
    for (const recorded of Object.values(impact)) recorded.clear()
    syncing = true
    try {
      syncComponentsHolding(graph, ids)
    } finally {
      syncing = false
    }
  })
}

/**
 * Syncs the instances of the components edited since, before a read; given the layer about to be
 * read or written, only when it is in an instance, as only those layers change. Edits inside a
 * component then sync once, when an instance is next read, not once per edit.
 */
export function flushPendingComponentSync(graph: SceneGraph, layerId?: string): void {
  const flush = syncByGraph.get(graph)
  if (!flush) return
  if (layerId !== undefined && !graph.closest(layerId, (node) => node.type === 'INSTANCE')) return
  flush()
}
