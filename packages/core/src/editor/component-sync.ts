import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'

export function createComponentSyncScheduler(
  getGraph: () => SceneGraph,
  requestRender: () => void
) {
  let pendingComponentSync: Set<string> | null = null
  let isFlushingComponentSync = false

  function collectContainingComponent(
    graph: SceneGraph,
    nodeId: string,
    componentIds: Set<string>
  ) {
    let current = graph.getNode(nodeId)
    while (current) {
      if (current.type === 'COMPONENT') {
        componentIds.add(current.id)
        break
      }
      current = current.parentId ? graph.getNode(current.parentId) : undefined
    }
  }

  function collectInstanceAncestorComponents(
    graph: SceneGraph,
    componentId: string,
    componentIds: Set<string>
  ) {
    const instanceIds = graph.instanceIndex.get(componentId)
    if (!instanceIds) return
    for (const instanceId of instanceIds) {
      let parentId = graph.getNode(instanceId)?.parentId ?? null
      while (parentId) {
        const parent = graph.getNode(parentId)
        if (!parent) break
        if (parent.type === 'COMPONENT') {
          componentIds.add(parent.id)
          break
        }
        parentId = parent.parentId
      }
    }
  }

  function flushComponentSync() {
    const ids = pendingComponentSync
    if (!ids) return
    pendingComponentSync = null
    isFlushingComponentSync = true
    try {
      const graph = getGraph()
      const componentIds = new Set<string>()
      for (const id of ids) {
        collectContainingComponent(graph, id, componentIds)
      }

      const syncedComponentIds = new Set<string>()
      for (const compId of componentIds) {
        if (syncedComponentIds.has(compId)) continue
        syncedComponentIds.add(compId)
        graph.syncInstances(compId)
        collectInstanceAncestorComponents(graph, compId, componentIds)
      }
      if (componentIds.size > 0) {
        computeAllLayouts(graph)
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
