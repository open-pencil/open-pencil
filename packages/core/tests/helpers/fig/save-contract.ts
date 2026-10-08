import { expect } from 'bun:test'

import { omit } from 'es-toolkit/object'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

function pageOf(graph: SceneGraph, node: SceneNode): string | undefined {
  let current: SceneNode | undefined = node
  while (current?.parentId && current.parentId !== graph.rootId)
    current = graph.getNode(current.parentId)
  return current?.id
}

/** The document's layers before a save, to compare with what it holds after. */
export function snapshotNodes(graph: SceneGraph): Map<string, SceneNode> {
  return new Map(structuredClone([...graph.nodes]))
}

/**
 * A save may read internal-only pages into the document, so later saves need not read them
 * again, but it never loads a visible page or changes anything the document already held. On an
 * internal page, a component set the visible pages needed in part gains its other variants.
 */
export function expectSaveLoadedOnlyInternalPages(
  graph: SceneGraph,
  before: ReadonlyMap<string, SceneNode>
): void {
  const internalPages = new Set(
    graph
      .getPages(true)
      .filter((page) => page.internalOnly)
      .map((page) => page.id)
  )
  for (const [id, node] of before) {
    const now = graph.getNode(id)
    if (!internalPages.has(id) && !internalPages.has(pageOf(graph, node) ?? '')) {
      expect(now).toEqual(node)
      continue
    }
    expect(now && omit(now, ['childIds'])).toEqual(omit(node, ['childIds']))
    // The children it held keep their order; loaded variants may sit between them.
    const kept = new Set(node.childIds)
    expect(now?.childIds.filter((id) => kept.has(id))).toEqual(node.childIds)
  }
  const added = [...graph.getAllNodes()].filter((node) => !before.has(node.id))
  expect(added.filter((node) => !internalPages.has(pageOf(graph, node) ?? ''))).toEqual([])
}
