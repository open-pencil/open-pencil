import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  finishRenderPlacement,
  resolveRenderPlacement,
  type RenderPlacementInput
} from '#core/design-jsx/placement'
import { renderTree, type RenderResult } from '#core/design-jsx/renderer'
import type { TreeNode } from '#core/design-jsx/tree'
import { extractExportGraph } from '#core/io/subgraph'

const MAX_PREVIEW_CONTEXT_NODES = 1000

export interface StagedJSXPreview {
  graph: SceneGraph
  pageId: string
  nodeIds: string[]
  /** Existing page child to replace visually, without changing the source graph. */
  replaceId?: string
  /** Page insertion slot when the preview adds new top-level nodes. */
  insertIndex?: number
}

function topLevelOwner(graph: SceneGraph, id: string, pageId: string): string {
  let node = graph.getNode(id)
  while (node?.parentId && node.parentId !== pageId) node = graph.getNode(node.parentId)
  if (!node) throw new Error('Preview owner does not exist')
  return node.id
}

function contextFits(graph: SceneGraph, rootId: string): boolean {
  const pending = [rootId]
  let count = 0
  while (pending.length > 0) {
    if (++count > MAX_PREVIEW_CONTEXT_NODES) return false
    const id = pending.pop()
    const node = id ? graph.getNode(id) : undefined
    if (node) pending.push(...node.childIds)
  }
  return true
}

/** Clone the whole affected page child, preserving ancestors, siblings, padding and layout modes. */
export async function stageJSXPreview(
  source: SceneGraph,
  tree: TreeNode,
  input: RenderPlacementInput,
  pageId: string,
  signal?: AbortSignal
): Promise<StagedJSXPreview | null> {
  signal?.throwIfAborted()
  const placement = resolveRenderPlacement(source, input, pageId)
  if (placement.pageId !== pageId) return null
  const owner =
    placement.parentId === pageId
      ? placement.replaceId
      : topLevelOwner(source, placement.parentId, pageId)
  if (owner && !contextFits(source, owner)) return null
  const { graph } = extractExportGraph(source, {
    scope: 'selection',
    nodeIds: owner ? [owner] : []
  })
  if (!graph.getNode(pageId)) {
    const page = source.getNode(pageId)
    if (!page) return null
    graph.nodes.set(pageId, { ...structuredClone(page), childIds: [] })
    graph.getNode(graph.rootId)?.childIds.push(pageId)
  }
  // Preview props can introduce bindings/images not referenced by the old subtree.
  graph.images = new Map(source.images)
  graph.variables = structuredClone(source.variables)
  graph.variableCollections = structuredClone(source.variableCollections)
  const results: RenderResult[] = []
  for (const root of tree.type === '' ? tree.children : [tree]) {
    if (typeof root === 'string') continue
    signal?.throwIfAborted()
    results.push(await renderTree(graph, root, placement))
  }
  signal?.throwIfAborted()
  if (results.length === 0) return null
  finishRenderPlacement(graph, results, placement)
  return {
    graph,
    pageId,
    nodeIds: owner && graph.getNode(owner) ? [owner] : results.map((result) => result.id),
    replaceId: owner,
    insertIndex: placement.insertIndex
  }
}
