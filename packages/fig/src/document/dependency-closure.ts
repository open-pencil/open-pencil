import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { componentDependencies } from './component/dependencies'
import { createResourceResolver } from './resource-reference'

export interface SceneDependencyClosure {
  /** Live page trees plus explicitly referenced component trees. */
  contentIds: ReadonlySet<string>
  /** Required ownership containers, without automatically including their siblings. */
  ancestorIds: ReadonlySet<string>
  missingIds: ReadonlySet<string>
  externalPreferredKeys: ReadonlySet<string>
}

function validatePageSelection(
  sources: ReadonlyMap<string, NodeChange>,
  pageIds?: ReadonlySet<string>
): void {
  if (!pageIds) return
  for (const id of pageIds)
    if (sources.get(id)?.type !== 'CANVAS') throw new Error(`Unknown page ${id}`)
}

/** Plan reachability without deleting records or expanding unrelated internal siblings. */
export function collectSceneDependencies(
  changes: readonly NodeChange[],
  pageIds?: ReadonlySet<string>
): SceneDependencyClosure {
  const resolveReference = createResourceResolver(changes)
  const sources = new Map<string, NodeChange>()
  const children = new Map<string, string[]>()
  for (const node of changes) {
    if (!node.guid) continue
    const id = guidToString(node.guid)
    if (sources.has(id)) throw new Error(`Duplicate source node ${id}`)
    sources.set(id, node)
    if (!node.parentIndex?.guid) continue
    const parent = guidToString(node.parentIndex.guid)
    const siblings = children.get(parent) ?? []
    siblings.push(id)
    children.set(parent, siblings)
  }
  const contentIds = new Set<string>()
  const ancestorIds = new Set<string>()
  const externalPreferredKeys = new Set<string>()
  const missingIds = new Set<string>()
  validatePageSelection(sources, pageIds)
  const pending = changes
    .filter(
      (node) =>
        node.type === 'CANVAS' &&
        (pageIds ? !!node.guid && pageIds.has(guidToString(node.guid)) : node.internalOnly !== true)
    )
    .flatMap((node) => (node.guid ? [guidToString(node.guid)] : []))
  while (pending.length) {
    const id = pending.pop()
    if (!id || contentIds.has(id)) continue
    const node = sources.get(id)
    if (!node) {
      missingIds.add(id)
      continue
    }
    contentIds.add(id)
    pending.push(
      ...(children.get(id) ?? []),
      ...componentDependencies(node, resolveReference, (key) => externalPreferredKeys.add(key))
    )
  }
  for (const id of contentIds) {
    let node = sources.get(id)
    const visited = new Set<string>([id])
    while (node?.parentIndex?.guid) {
      const parent = guidToString(node.parentIndex.guid)
      if (visited.has(parent)) throw new Error(`Cyclic source hierarchy at ${parent}`)
      visited.add(parent)
      if (ancestorIds.has(parent)) break
      ancestorIds.add(parent)
      node = sources.get(parent)
      if (!node) missingIds.add(parent)
    }
  }
  return { contentIds, ancestorIds, missingIds, externalPreferredKeys }
}
