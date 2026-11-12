import type { SceneGraph, SceneGraphEvents, SceneNode } from '@open-pencil/scene-graph'
import { TRANSFORM_FIELDS } from '@open-pencil/scene-graph/fields'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { markFlowChanged } from '#core/layout/derived'

type EmittedGraphEventName = keyof SceneGraphEvents

/** The renderer surface graph events invalidate; tests provide a double of just this. */
export type GraphEventRenderer = Pick<
  SkiaRenderer,
  'invalidateVectorPath' | 'invalidateNodePicture' | 'forgetNode'
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

// A vector's open corners are rounded by its corner radius, so its paths follow that too.
const GEOMETRY_CACHE_KEYS = new Set<keyof SceneNode>([
  'vectorNetwork',
  'cornerRadius',
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

/** The boolean operations `id` lies in, nearest first: any change inside one changes its result. */
function booleanAncestorIds(graph: SceneGraph, id: string | null | undefined): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  let node = id ? graph.getNode(id) : undefined
  // Bad data can hold a parent cycle; the walk ends where it has been.
  while (node && !seen.has(node.id)) {
    seen.add(node.id)
    if (node.type === 'BOOLEAN_OPERATION') ids.push(node.id)
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return ids
}

/**
 * Drops the cached result of every boolean operation `id` lies in, on each renderer: a change
 * inside an operation changes what it draws and the box it takes.
 */
export function invalidateBooleanAncestors(
  graph: SceneGraph,
  renderers: Iterable<GraphEventRenderer>,
  id: string | null | undefined
): void {
  const ancestorIds = booleanAncestorIds(graph, id)
  if (ancestorIds.length === 0) return
  for (const renderer of renderers) {
    for (const ancestorId of ancestorIds) {
      renderer.invalidateVectorPath(ancestorId)
      renderer.invalidateNodePicture(ancestorId)
    }
  }
}

function invalidateRenderersForChange(
  graph: SceneGraph,
  renderers: Iterable<GraphEventRenderer>,
  id: string,
  changes: Partial<SceneNode>,
  invalidateNodePicture: boolean
) {
  const invalidation = rendererInvalidationForChanges(changes, { preview: !invalidateNodePicture })
  // From the layer itself: a boolean operation's own change, such as its operation, counts too.
  invalidateBooleanAncestors(graph, renderers, id)
  for (const renderer of renderers) {
    if (invalidation.geometryCache) renderer.invalidateVectorPath(id)
    if (invalidation.nodePicture)
      renderer.invalidateNodePicture(id, Object.keys(changes) as (keyof SceneNode)[])
    if (Object.keys(changes).some((key) => TILED_CHUNK_TOPOLOGY_KEYS.has(key as keyof SceneNode))) {
      renderer.tiledScene.invalidateStructure(id, graph.getNode(id)?.parentId ?? null)
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

  /** Tells the renderers a layer was added, removed, or moved under `parentId`. */
  function invalidateStructure(nodeId: string, parentId?: string | null) {
    const graph = options.getGraph()
    const parent = parentId ?? graph.getNode(nodeId)?.parentId ?? null
    invalidateBooleanAncestors(graph, options.getRenderers(), parent)
    for (const renderer of options.getRenderers()) {
      renderer.invalidateNodePicture(nodeId)
      renderer.tiledScene.invalidateStructure(nodeId, parent)
    }
  }

  function onNodeStructureChanged(nodeId: string, parentId?: string | null) {
    invalidateStructure(nodeId, parentId)
    options.scheduleComponentSync(nodeId)
    requestRenderFor(options.getGraph())
  }

  /**
   * An edit that adds, removes, or moves a layer changes its parent's flow, which then stops
   * keeping the geometry a file saved for it. Loading a page and laying out are not edits.
   */
  function flowChanged(parentId: string | null | undefined) {
    const graph = options.getGraph()
    if (!parentId || graph.isApplyingImportedState || graph.isApplyingLayout) return
    markFlowChanged(graph, parentId)
  }

  function subscribeToGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = options.getGraph().onNodeEvents({
      updated: onNodeUpdated,
      previewUpdated: onNodePreviewUpdated,
      created: (node) => {
        options.emitEditorEvent('node:created', node)
        onNodeStructureChanged(node.id)
        flowChanged(node.parentId)
      },
      // A layer that leaves a component, deleted or moved out, changes the component it left;
      // the parent it had finds that component when the sync runs.
      deleted: (id, parentId) => {
        options.emitEditorEvent('node:deleted', id, parentId)
        for (const renderer of options.getRenderers()) renderer.forgetNode(id)
        onNodeStructureChanged(id, parentId)
        flowChanged(parentId)
        if (parentId) options.scheduleComponentSync(parentId)
      },
      reparented: (nodeId, oldParentId, newParentId) => {
        options.emitEditorEvent('node:reparented', nodeId, oldParentId, newParentId)
        // Both parents are told; the frame is asked for once.
        invalidateStructure(nodeId, newParentId)
        invalidateStructure(nodeId, oldParentId)
        options.scheduleComponentSync(nodeId)
        requestRenderFor(options.getGraph())
        flowChanged(oldParentId)
        flowChanged(newParentId)
        if (oldParentId) options.scheduleComponentSync(oldParentId)
      },
      reordered: (nodeId, parentId, index, previousParentId) => {
        options.emitEditorEvent('node:reordered', nodeId, parentId, index, previousParentId)
        onNodeStructureChanged(nodeId, parentId)
        if (previousParentId && previousParentId !== parentId) {
          onNodeStructureChanged(nodeId, previousParentId)
        }
        flowChanged(parentId)
        flowChanged(previousParentId)
        if (previousParentId && previousParentId !== parentId) {
          options.scheduleComponentSync(previousParentId)
        }
      }
    })
  }

  function unsubscribeFromGraph() {
    unbindGraphEvents?.()
    unbindGraphEvents = null
  }

  return { subscribeToGraph, unsubscribeFromGraph }
}
