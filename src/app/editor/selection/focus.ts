import type { SceneGraph } from '@open-pencil/scene-graph'

/** What focusing needs from the editor, so a caller can drive it without a whole store. */
export interface FocusStore {
  graph: Pick<SceneGraph, 'getChildren' | 'getNode'>
  state: { currentPageId: string }
  select: (ids: string[]) => void
  zoomToSelection: () => void
}

/**
 * Ids of the nodes named exactly `name` on the current page, in document order.
 *
 * Exact and case-sensitive on purpose: a link names one layer, where the `find_nodes`
 * tool offers the forgiving search a person does by hand.
 */
export function findNodesByName(
  graph: FocusStore['graph'],
  rootId: string,
  name: string
): string[] {
  const matches: string[] = []
  const walk = (parentId: string) => {
    for (const child of graph.getChildren(parentId)) {
      if (child.name === name) matches.push(child.id)
      walk(child.id)
    }
  }
  walk(rootId)
  return matches
}

/**
 * Selects the nodes and zooms to them. False when none of the ids is in the document,
 * so a caller holding a stale id can tell that nothing was brought into view.
 */
export function focusNodes(store: FocusStore, ids: readonly string[]): boolean {
  const present = ids.filter((id) => store.graph.getNode(id) !== undefined)
  if (present.length === 0) return false
  store.select(present)
  store.zoomToSelection()
  return true
}

/** Focuses every node with that exact name on the current page. */
export function focusNodesByName(store: FocusStore, name: string): boolean {
  return focusNodes(store, findNodesByName(store.graph, store.state.currentPageId, name))
}
