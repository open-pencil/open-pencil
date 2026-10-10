import { uniq } from 'es-toolkit/array'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractPageContext } from '#core/io/subgraph'

import { applyDocumentChange, type DocumentChange } from './document-change'
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
 * A standalone copy of the document with the pages a change touched, and the page it ran on, on
 * one side of the change. The source must be as the change left it, as it is right after the
 * edit. Other pages are left empty.
 */
export function graphFromDocumentChange(
  source: SceneGraph,
  change: DocumentChange,
  side: 'before' | 'after'
): SceneGraph | null {
  // A page's own id brings its whole subtree; a layer moved between pages can then move back.
  const pageIds = uniq([change.pageId, ...change.pageIds]).filter((id) => source.getNode(id))
  const [first] = pageIds
  if (!first) return null
  const graph = pageContext(source, first, pageIds)
  if (side === 'before') applyDocumentChange(graph, change, 'before')
  graph.clearAbsPosCache()
  return graph
}
