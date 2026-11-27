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
  const nextImportedId = state.nextImportedId
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
      state.nextImportedId = nextImportedId
      for (const [id, entries] of graph.instanceIndex)
        if (!entries.size) graph.instanceIndex.delete(id)
      graph.clearAbsPosCache()
      graph.sharedStyleIndex.invalidate()
      throw error
    }
  })
}

/**
 * The layers a load added, each placed before the first layer that follows it in saved order;
 * the layers that were there keep the order they had.
 */
function mergeSavedOrder(
  previous: readonly string[],
  current: readonly string[],
  saved: readonly string[]
): string[] {
  const rank = new Map(saved.map((id, index) => [id, index]))
  const present = new Set(current)
  const earlier = new Set(previous)
  const kept = previous.filter((id) => present.has(id))
  for (const id of current) {
    if (earlier.has(id)) {
      continue
    }
    const own = rank.get(id) ?? Number.POSITIVE_INFINITY
    const next = kept.findIndex((existing) => (rank.get(existing) ?? -1) > own)
    kept.splice(next === -1 ? kept.length : next, 0, id)
  }
  return kept
}

/**
 * Run a load that adds layers to containers earlier loads built: those keep the order they had,
 * and each new layer takes its saved place among them.
 */
export function keepContainerOrder(
  state: AssemblyState,
  reader: { savedChildIds: (sourceId: string) => readonly string[] },
  containerIds: Iterable<string>,
  load: () => void
): void {
  const containers = [...new Set(containerIds)].flatMap((sourceId) => {
    const layer = state.graph.getNode(state.sources.get(sourceId) ?? '')
    return layer && layer.childIds.length > 0
      ? [{ sourceId, layer, previous: [...layer.childIds] }]
      : []
  })
  load()
  for (const { sourceId, layer, previous } of containers) {
    const saved = reader
      .savedChildIds(sourceId)
      .flatMap((childId) => state.sources.get(childId) ?? [])
    if (saved.length > 0) {
      layer.childIds = mergeSavedOrder(previous, layer.childIds, saved)
    }
  }
}
