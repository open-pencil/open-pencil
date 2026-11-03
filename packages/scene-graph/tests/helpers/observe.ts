import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { cloneInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'
import {
  createSceneMutationImpact,
  recordSceneMutations
} from '@open-pencil/scene-graph/mutation-impact'

/** What a recorder keeps in `before()`: the first copy of each reported node, plus the touched set. */
export function observeWrites(graph: SceneGraph) {
  const before = new Map<
    string,
    { overrides: SceneNode['instanceOverrides']; boundVariables: SceneNode['boundVariables'] }
  >()
  const created = new Set<string>()
  const impact = createSceneMutationImpact()
  const stopChanges = graph.observeNodeChanges({
    created: (node) => created.add(node.id),
    before: (node) => {
      if (before.has(node.id)) return
      before.set(node.id, {
        overrides: cloneInstanceOverrideState(node.instanceOverrides),
        boundVariables: { ...node.boundVariables }
      })
    }
  })
  const stopEvents = recordSceneMutations(graph, impact)
  return {
    before,
    created,
    touched: impact.changedNodeIds,
    stop: () => {
      stopChanges()
      stopEvents()
    }
  }
}
