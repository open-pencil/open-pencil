import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph, SceneGraphEvents, SceneNode } from '#core/scene-graph'

type GraphEventOptions = {
  getGraph: () => SceneGraph
  getRenderers: () => Iterable<SkiaRenderer>
  scheduleComponentSync: (nodeId: string) => void
  requestRender: () => void
  emitEditorEvent: <K extends keyof SceneGraphEvents>(
    event: K,
    ...args: Parameters<SceneGraphEvents[K]>
  ) => void
}

export function createGraphEventSubscription(options: GraphEventOptions) {
  let unbindGraphEvents: (() => void) | null = null

  function invalidateNodePictureLineage(nodeId: string) {
    const graph = options.getGraph()
    for (const renderer of options.getRenderers()) {
      let current = graph.getNode(nodeId)
      while (current) {
        renderer.invalidateNodePicture(current.id)
        current = current.parentId ? (graph.getNode(current.parentId) ?? undefined) : undefined
      }
    }
  }

  function onNodeUpdated(id: string, changes: Partial<SceneNode>) {
    for (const renderer of options.getRenderers()) {
      if ('vectorNetwork' in changes) renderer.invalidateVectorPath(id)
    }
    invalidateNodePictureLineage(id)
    options.emitEditorEvent('node:updated', id, changes)
    options.scheduleComponentSync(id)
    options.requestRender()
  }

  function onNodeStructureChanged(nodeId: string) {
    for (const renderer of options.getRenderers()) {
      renderer.invalidateAllPictures()
    }
    options.scheduleComponentSync(nodeId)
    options.requestRender()
  }

  function subscribeToGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = options.getGraph().onNodeEvents({
      updated: onNodeUpdated,
      created: (node) => {
        options.emitEditorEvent('node:created', node)
        onNodeStructureChanged(node.id)
      },
      deleted: (id) => {
        options.emitEditorEvent('node:deleted', id)
        onNodeStructureChanged(id)
      },
      reparented: (nodeId, oldParentId, newParentId) => {
        options.emitEditorEvent('node:reparented', nodeId, oldParentId, newParentId)
        onNodeStructureChanged(nodeId)
      },
      reordered: (nodeId, parentId, index) => {
        options.emitEditorEvent('node:reordered', nodeId, parentId, index)
        onNodeStructureChanged(nodeId)
      }
    })
  }

  return { subscribeToGraph }
}
