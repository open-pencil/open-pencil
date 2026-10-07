import type { SceneGraph } from './index'
import type { GUID } from './primitives'
import type { SceneNode } from './types'

export interface CanvasGuide {
  id: string
  axis: 'x' | 'y'
  position: number
  figGuid?: GUID
}

const ownersByGraph = new WeakMap<SceneGraph, Set<string>>()

function ownerSet(graph: SceneGraph): Set<string> {
  const existing = ownersByGraph.get(graph)
  if (existing) return existing
  const owners = new Set<string>()
  for (const node of graph.getAllNodes()) if (node.guides.length > 0) owners.add(node.id)
  const track = (node: SceneNode | undefined, id: string) => {
    if (node && node.guides.length > 0) owners.add(id)
    else owners.delete(id)
  }
  graph.onNodeEvents({
    created: (node) => track(node, node.id),
    updated: (id, changes) => {
      if ('guides' in changes) track(graph.getNode(id), id)
    },
    deleted: (id) => owners.delete(id)
  })
  ownersByGraph.set(graph, owners)
  return owners
}

/**
 * The layers on a page that carry guides, which a frame anywhere in the tree can, as in Figma.
 * The graph keeps the set current from its node events, so drawing and hit-testing guides do not
 * walk the page's whole tree on every frame.
 */
export function guideOwnersOnPage(graph: SceneGraph, pageId: string): SceneNode[] {
  const owners: SceneNode[] = []
  for (const id of ownerSet(graph)) {
    const node = graph.getNode(id)
    if (!node || node.guides.length === 0) continue
    if (graph.closest(id, (ancestor) => ancestor.type === 'CANVAS')?.id === pageId)
      owners.push(node)
  }
  return owners
}
