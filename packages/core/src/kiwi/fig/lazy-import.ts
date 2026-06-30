import type { SceneGraph } from '@open-pencil/scene-graph'

import { populateAndApplyOverrides } from '#core/kiwi/fig/instance-overrides'
import type { InstanceNodeChange } from '#core/kiwi/fig/instance-overrides'

export interface LazyFigImportContext {
  changeMap: Map<string, InstanceNodeChange>
  guidToNodeId: Map<string, string>
  blobs: Uint8Array[]
  populatedRootIds: Set<string>
}

const lazyFigImportContexts = new WeakMap<SceneGraph, LazyFigImportContext>()

export function setLazyFigImportContext(graph: SceneGraph, context: LazyFigImportContext): void {
  lazyFigImportContexts.set(graph, context)
}

export function getLazyFigImportContext(graph: SceneGraph): LazyFigImportContext | undefined {
  return lazyFigImportContexts.get(graph)
}

function populateRoots(
  graph: SceneGraph,
  context: LazyFigImportContext,
  rootIds: Iterable<string>
): boolean {
  const pending = [...rootIds].filter((id) => id && !context.populatedRootIds.has(id))
  if (pending.length === 0) return false

  graph.preserveSourceMetadataDuring(() => {
    populateAndApplyOverrides(
      graph,
      context.changeMap,
      context.guidToNodeId,
      context.blobs,
      pending
    )
  })

  for (const id of pending) context.populatedRootIds.add(id)
  return true
}

export function populateLazyFigImportRoots(graph: SceneGraph, rootIds: Iterable<string>): boolean {
  const context = getLazyFigImportContext(graph)
  return context ? populateRoots(graph, context, rootIds) : false
}

export function populateAllLazyFigImportRoots(graph: SceneGraph): boolean {
  const context = getLazyFigImportContext(graph)
  if (!context) return false
  return populateRoots(
    graph,
    context,
    graph.getPages(true).map((page) => page.id)
  )
}
