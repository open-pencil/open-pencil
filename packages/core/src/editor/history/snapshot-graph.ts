import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractPageContext } from '#core/io/subgraph'

import type { PageSnapshot } from './snapshot'

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
  const graph = extractPageContext(source, page.id, [])
  graph.images = new Map(source.images)
  graph.variables = structuredClone(source.variables)
  graph.variableCollections = structuredClone(source.variableCollections)
  for (const node of snapshot.values()) graph.nodes.set(node.id, structuredClone(node))
  graph.clearAbsPosCache()
  return graph
}
