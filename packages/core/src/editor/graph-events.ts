import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

type GraphEventOptions = {
  getGraph: () => SceneGraph
  getRenderer: () => SkiaRenderer | null
  scheduleComponentSync: (nodeId: string) => void
  requestRender: () => void
}

export function createGraphEventSubscription(options: GraphEventOptions) {
  let unbindGraphEvents: (() => void) | null = null

  function onNodeUpdated(id: string, changes: Partial<SceneNode>) {
    if ('vectorNetwork' in changes) {
      options.getRenderer()?.invalidateVectorPath(id)
    }
    options.getRenderer()?.invalidateNodePicture(id)
    options.scheduleComponentSync(id)
    options.requestRender()
  }

  function onNodeStructureChanged(nodeId: string) {
    options.scheduleComponentSync(nodeId)
    options.requestRender()
  }

  function subscribeToGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = options.getGraph().onNodeEvents({
      updated: onNodeUpdated,
      created: (node) => onNodeStructureChanged(node.id),
      deleted: onNodeStructureChanged,
      reparented: onNodeStructureChanged,
      reordered: onNodeStructureChanged
    })
  }

  return { subscribeToGraph }
}
