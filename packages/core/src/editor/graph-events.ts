import {
  TRANSFORM_FIELDS,
  type SceneGraph,
  type SceneGraphEvents,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

type EmittedGraphEventName = keyof SceneGraphEvents

/** The renderer surface graph events invalidate; tests provide a double of just this. */
export type GraphEventRenderer = Pick<
  SkiaRenderer,
  'invalidateVectorPath' | 'invalidateNodePicture'
> & {
  tiledScene: Pick<SkiaRenderer['tiledScene'], 'invalidateNode' | 'invalidateStructure'>
}

type GraphEventOptions = {
  getGraph: () => SceneGraph
  getRenderers: () => Iterable<GraphEventRenderer>
  scheduleComponentSync: (nodeId: string) => void
  requestRender: () => void
  emitEditorEvent: <K extends EmittedGraphEventName>(
    event: K,
    ...args: Parameters<SceneGraphEvents[K]>
  ) => void
}

const GEOMETRY_CACHE_KEYS = new Set<keyof SceneNode>([
  'vectorNetwork',
  'fillGeometry',
  'strokeGeometry'
])

const TILED_CHUNK_TOPOLOGY_KEYS = new Set<keyof SceneNode>([
  'type',
  'visible',
  'isMask',
  'maskType'
])

const NODE_PICTURE_STABLE_PREVIEW_KEYS = new Set<keyof SceneNode>([...TRANSFORM_FIELDS, 'parentId'])

export type RendererInvalidation = {
  geometryCache: boolean
  nodePicture: boolean
}

export function rendererInvalidationForChanges(
  changes: Partial<SceneNode>,
  options: { preview: boolean }
): RendererInvalidation {
  const keys = Object.keys(changes) as (keyof SceneNode)[]
  const geometryCache = keys.some((key) => GEOMETRY_CACHE_KEYS.has(key))
  const nodePicture = options.preview
    ? keys.some((key) => !NODE_PICTURE_STABLE_PREVIEW_KEYS.has(key))
    : true
  return { geometryCache, nodePicture }
}

function invalidateRenderersForChange(
  graph: SceneGraph,
  renderers: Iterable<GraphEventRenderer>,
  id: string,
  changes: Partial<SceneNode>,
  invalidateNodePicture: boolean
) {
  const invalidation = rendererInvalidationForChanges(changes, { preview: !invalidateNodePicture })
  for (const renderer of renderers) {
    if (invalidation.geometryCache) renderer.invalidateVectorPath(id)
    if (invalidation.nodePicture)
      renderer.invalidateNodePicture(id, Object.keys(changes) as (keyof SceneNode)[])
    if (Object.keys(changes).some((key) => TILED_CHUNK_TOPOLOGY_KEYS.has(key as keyof SceneNode))) {
      renderer.tiledScene.invalidateStructure()
    } else {
      renderer.tiledScene.invalidateNode(id, graph)
    }
  }
}

export function createGraphEventSubscription(options: GraphEventOptions) {
  let unbindGraphEvents: (() => void) | null = null
  let batchRenderPending = false

  /**
   * A layout pass or a page's layers loading updates many layers at once, and each render
   * request bumps reactive versions; the batch asks for one render after it, before the next
   * frame draws.
   */
  function requestRenderFor(graph: SceneGraph) {
    if (!graph.isApplyingLayout && !graph.isApplyingImportedState) {
      options.requestRender()
      return
    }
    if (batchRenderPending) return
    batchRenderPending = true
    queueMicrotask(() => {
      batchRenderPending = false
      options.requestRender()
    })
  }

  function onNodeUpdated(id: string, changes: Partial<SceneNode>) {
    const graph = options.getGraph()
    invalidateRenderersForChange(graph, options.getRenderers(), id, changes, true)
    options.emitEditorEvent('node:updated', id, changes)
    options.scheduleComponentSync(id)
    requestRenderFor(graph)
  }

  function onNodePreviewUpdated(id: string, changes: Partial<SceneNode>) {
    const { nodePicture } = rendererInvalidationForChanges(changes, { preview: true })
    invalidateRenderersForChange(
      options.getGraph(),
      options.getRenderers(),
      id,
      changes,
      nodePicture
    )
    options.emitEditorEvent('node:previewUpdated', id, changes)
  }

  function onNodeStructureChanged(nodeId: string) {
    for (const renderer of options.getRenderers()) {
      renderer.invalidateNodePicture(nodeId)
      renderer.tiledScene.invalidateStructure()
    }
    options.scheduleComponentSync(nodeId)
    requestRenderFor(options.getGraph())
  }

  function subscribeToGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = options.getGraph().onNodeEvents({
      updated: onNodeUpdated,
      previewUpdated: onNodePreviewUpdated,
      created: (node) => {
        options.emitEditorEvent('node:created', node)
        onNodeStructureChanged(node.id)
      },
      deleted: (id, _parentId) => {
        options.emitEditorEvent('node:deleted', id, _parentId)
        onNodeStructureChanged(id)
      },
      reparented: (nodeId, oldParentId, newParentId) => {
        options.emitEditorEvent('node:reparented', nodeId, oldParentId, newParentId)
        onNodeStructureChanged(nodeId)
      },
      reordered: (nodeId, parentId, index, previousParentId) => {
        options.emitEditorEvent('node:reordered', nodeId, parentId, index, previousParentId)
        onNodeStructureChanged(nodeId)
      }
    })
  }

  function unsubscribeFromGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = null
  }

  return { subscribeToGraph, unsubscribeFromGraph }
}
