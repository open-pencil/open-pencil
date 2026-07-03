import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'

export function createComponentSyncScheduler(
  getGraph: () => SceneGraph,
  requestRender: () => void
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
      for (const compId of componentIds) {
        graph.syncInstances(compId)
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
