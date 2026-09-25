import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'

function componentSyncOrder(graph: SceneGraph, seeds: Set<string>): string[] {
  const dependents = new Map<string, Set<string>>()
  const discover = (id: string): void => {
    if (dependents.has(id)) return
    const parents = new Set<string>()
    dependents.set(id, parents)
    for (const instance of graph.getInstances(id)) {
      let parent = instance.parentId ? graph.getNode(instance.parentId) : undefined
      while (parent && parent.type !== 'COMPONENT') {
        parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
      }
      if (parent) parents.add(parent.id)
    }
    for (const parent of parents) discover(parent)
  }
  for (const id of seeds) discover(id)
  const result: string[] = []
  const active = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (active.has(id)) throw new Error('Cyclic component synchronization dependency')
    if (visited.has(id)) return
    active.add(id)
    for (const parent of dependents.get(id) ?? []) visit(parent)
    active.delete(id)
    visited.add(id)
    result.push(id)
  }
  for (const id of seeds) visit(id)
  return result.reverse()
}

type ComputeLayouts = (graph: SceneGraph, scopeId?: string) => void

/** Pages are `CANVAS` nodes; layout recomputation is scoped to them. */
function pageIdOf(graph: SceneGraph, nodeId: string): string | null {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'CANVAS') return current.id
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return null
}

/**
 * Only the pages that actually changed need layout work: the edited subtrees, the components
 * they belong to, and every instance of those components, which may sit on another page.
 */
function affectedPageIds(
  graph: SceneGraph,
  editedIds: Iterable<string>,
  componentIds: Iterable<string>
): Set<string> {
  const pageIds = new Set<string>()
  const addPageOf = (nodeId: string) => {
    const pageId = pageIdOf(graph, nodeId)
    if (pageId) pageIds.add(pageId)
  }

  for (const id of editedIds) addPageOf(id)
  for (const componentId of componentIds) {
    addPageOf(componentId)
    for (const instance of graph.getInstances(componentId)) addPageOf(instance.id)
  }
  return pageIds
}

export function createComponentSyncScheduler(
  getGraph: () => SceneGraph,
  requestRender: () => void,
  computeLayouts: ComputeLayouts = computeAllLayouts
) {
  let pendingComponentSync: Set<string> | null = null
  let isFlushingComponentSync = false

  function flushComponentSync() {
    const ids = pendingComponentSync
    if (!ids) return
    pendingComponentSync = null
    isFlushingComponentSync = true
    try {
      const graph = getGraph()
      const componentIds = new Set<string>()
      for (const id of ids) {
        let current = graph.getNode(id)
        while (current) {
          if (current.type === 'COMPONENT') {
            componentIds.add(current.id)
            break
          }
          current = current.parentId ? graph.getNode(current.parentId) : undefined
        }
      }
      for (const compId of componentSyncOrder(graph, componentIds)) {
        graph.syncInstances(compId)
      }
      if (componentIds.size > 0) {
        const pageIds = affectedPageIds(graph, ids, componentIds)
        if (pageIds.size === 0) computeLayouts(graph)
        else for (const pageId of pageIds) computeLayouts(graph, pageId)
        requestRender()
      }
    } finally {
      isFlushingComponentSync = false
    }
  }

  function scheduleComponentSync(nodeId: string) {
    if (isFlushingComponentSync) return
    if (!pendingComponentSync) {
      pendingComponentSync = new Set()
      queueMicrotask(flushComponentSync)
    }
    pendingComponentSync.add(nodeId)
  }

  return { scheduleComponentSync }
}
