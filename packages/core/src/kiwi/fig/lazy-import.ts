import { populateAndApplyOverrides } from '@open-pencil/fig/instance-overrides'
import type { InstanceNodeChange } from '@open-pencil/fig/instance-overrides'
import type { SceneGraph } from '@open-pencil/scene-graph'

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

function applyPopulation(
  graph: SceneGraph,
  context: LazyFigImportContext,
  rootIds?: string[]
): void {
  graph.preserveSourceMetadataDuring(() => {
    populateAndApplyOverrides(
      graph,
      context.changeMap,
      context.guidToNodeId,
      context.blobs,
      rootIds
    )
  })
  const populatedRootIds = rootIds ?? graph.getPages(true).map((page) => page.id)
  for (const id of populatedRootIds) context.populatedRootIds.add(id)
}

function populateRoots(
  graph: SceneGraph,
  context: LazyFigImportContext,
  rootIds: Iterable<string>
): boolean {
  const pending = [...rootIds].filter((id) => id && !context.populatedRootIds.has(id))
  if (pending.length === 0) return false
  applyPopulation(graph, context, pending)
  return true
}

export function populateLazyFigImportRoots(graph: SceneGraph, rootIds: Iterable<string>): boolean {
  const context = getLazyFigImportContext(graph)
  return context ? populateRoots(graph, context, rootIds) : false
}

export function populateAllLazyFigImportRoots(graph: SceneGraph): boolean {
  const context = getLazyFigImportContext(graph)
  if (!context) return false
  const rootIds = graph.getPages(true).map((page) => page.id)
  if (rootIds.every((id) => context.populatedRootIds.has(id))) return false

  // Revisit the initially populated page without an active-root filter.
  // Cross-page component chains can only stabilize when global override
  // resolution can see every source and target in the same pass.
  applyPopulation(graph, context)
  return true
}
