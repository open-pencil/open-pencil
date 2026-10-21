import type { SceneGraph } from '@open-pencil/scene-graph'
import { reconcileVariableBindings, type BindingScope } from '@open-pencil/scene-graph/variables'

import { computeLayout, computeSubtreeLayouts } from '#core/layout'

/**
 * Binding evaluation is derived work, not an additional history entry. The scope names what
 * changed, so only the layers that change can reach are resolved and laid out again.
 */
export function reconcileVariableLayouts(graph: SceneGraph, scope: BindingScope): void {
  const changed = new Set(reconcileVariableBindings(graph, scope))
  if (changed.size === 0) {
    return
  }
  graph.withLayoutMutations(() => layOutChangedLayers(graph, changed))
}

function layOutChangedLayers(graph: SceneGraph, changed: ReadonlySet<string>): void {
  const containing = containingLayers(graph, changed)
  const isInsideChanged = insideAnyOf(graph, changed)
  const relaidInstances = new Set([...changed, ...containing])
  for (const id of changed) {
    if (!isInsideChanged(id)) {
      computeSubtreeLayouts(graph, id, relaidInstances)
    }
  }
  const depth = depthOf(graph)
  const surrounding = [...containing]
    .filter((id) => !changed.has(id) && !isInsideChanged(id))
    .sort((a, b) => depth(b) - depth(a))
  for (const id of surrounding) {
    computeLayout(graph, id)
  }
}

function containingLayers(graph: SceneGraph, ids: Iterable<string>): Set<string> {
  const containing = new Set<string>()
  for (const id of ids) {
    let parentId = graph.getNode(id)?.parentId
    while (parentId && !containing.has(parentId)) {
      containing.add(parentId)
      parentId = graph.getNode(parentId)?.parentId
    }
  }
  return containing
}

function insideAnyOf(graph: SceneGraph, ids: ReadonlySet<string>): (id: string) => boolean {
  const known = new Map<string, boolean>()
  function isInside(id: string): boolean {
    const parentId = graph.getNode(id)?.parentId
    if (!parentId) {
      return false
    }
    const cached = known.get(parentId)
    if (cached !== undefined) {
      return cached
    }
    const inside = ids.has(parentId) || isInside(parentId)
    known.set(parentId, inside)
    return inside
  }
  return isInside
}

function depthOf(graph: SceneGraph): (id: string) => number {
  const known = new Map<string, number>()
  function depth(id: string): number {
    const cached = known.get(id)
    if (cached !== undefined) {
      return cached
    }
    const parentId = graph.getNode(id)?.parentId
    const result = parentId ? depth(parentId) + 1 : 0
    known.set(id, result)
    return result
  }
  return depth
}
