import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'

export function findAncestorComponentId(graph: SceneGraph, nodeId: string): string | null {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'COMPONENT') return current.id
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return null
}

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
    const componentId = findAncestorComponentId(graph, nodeId)
    if (componentId) componentIds.add(componentId)
  }

  function collectInstanceAncestorComponents(
    graph: SceneGraph,
    componentId: string,
    componentIds: Set<string>
  ) {
    const instanceIds = graph.instanceIndex.get(componentId)
    if (!instanceIds) return
    for (const instanceId of instanceIds) {
      const parentId = graph.getNode(instanceId)?.parentId
      if (!parentId) continue
      const ancestorId = findAncestorComponentId(graph, parentId)
      if (ancestorId) componentIds.add(ancestorId)
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

      for (const compId of componentIds) {
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
