import type { SceneNode } from '@open-pencil/scene-graph'

import type { SceneDependencyClosure } from './dependency-closure'
import type { AssemblyState } from './materialize'

/** Roll back selected-page mutations without cloning unrelated document payloads. */
export function loadPageTransaction(
  state: AssemblyState,
  closure: SceneDependencyClosure,
  action: () => void
): void {
  const { graph } = state
  const existingIds = new Set(graph.nodes.keys())
  const snapshots = new Map<SceneNode, SceneNode>()
  const candidateIds = new Set([graph.rootId, ...graph.getPages(true).map((page) => page.id)])
  for (const source of [...closure.contentIds, ...closure.ancestorIds]) {
    const id = state.sources.get(source)
    if (id) candidateIds.add(id)
  }
  for (const id of candidateIds) {
    const node = graph.getNode(id)
    if (node) snapshots.set(node, structuredClone(node))
  }
  const sources = new Map(state.sources)
  const components = new Map(state.components)
  const componentIds = new Map(state.componentIds)
  const sizes = new Set(state.savedSizeNodes)
  graph.withBufferedEvents(() => {
    try {
      action()
    } catch (error) {
      for (const [id, node] of graph.nodes) {
        if (existingIds.has(id)) continue
        if (node.componentId) graph.instanceIndex.get(node.componentId)?.delete(id)
        graph.nodes.delete(id)
      }
      for (const [node, snapshot] of snapshots) {
        if (node.componentId) graph.instanceIndex.get(node.componentId)?.delete(node.id)
        Object.assign(node, snapshot)
        if (node.type === 'INSTANCE' && node.componentId) {
          const entries = graph.instanceIndex.get(node.componentId) ?? new Set<string>()
          entries.add(node.id)
          graph.instanceIndex.set(node.componentId, entries)
        }
      }
      state.sources = sources
      state.components = components
      state.componentIds = componentIds
      state.savedSizeNodes = sizes
      for (const [id, entries] of graph.instanceIndex)
        if (!entries.size) graph.instanceIndex.delete(id)
      graph.clearAbsPosCache()
      throw error
    }
  })
}
