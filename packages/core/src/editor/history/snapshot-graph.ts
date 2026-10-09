import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractPageContext } from '#core/io/subgraph'

import { applyPageChange, type PageChange } from './page-change'
import type { PageSnapshot } from './snapshot'

function pageContext(source: SceneGraph, pageId: string, nodeIds: string[]): SceneGraph {
  const graph = extractPageContext(source, pageId, nodeIds)
  graph.images = new Map(source.images)
  graph.variables = structuredClone(source.variables)
  graph.variableCollections = structuredClone(source.variableCollections)
  return graph
}

/**
 * A standalone copy of the document whose snapshot page is as it was when taken, so a past
 * state can be rendered or diffed next to the live one. Other pages are left empty.
 */
export function graphFromPageSnapshot(
  source: SceneGraph,
  snapshot: PageSnapshot
): SceneGraph | null {
  // `snapshotPage` records the page first.
  const page = snapshot.values().next().value
  if (!page || !source.getNode(page.id)) return null
  const graph = pageContext(source, page.id, [])
  for (const node of snapshot.values()) graph.nodes.set(node.id, structuredClone(node))
  graph.clearAbsPosCache()
  return graph
}

/**
 * A standalone copy of the document with the change's page on one side of the change. The
 * source must be as the change left it, as it is right after the edit. Other pages are left
 * empty.
 */
export function graphFromPageChange(
  source: SceneGraph,
  change: PageChange,
  side: 'before' | 'after'
): SceneGraph | null {
  const page = source.getNode(change.pageId)
  if (!page) return null
  const graph = pageContext(source, page.id, page.childIds)
  if (side === 'before') applyPageChange(graph, change, 'before')
  graph.clearAbsPosCache()
  return graph
}
