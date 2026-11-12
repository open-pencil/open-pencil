import type { SceneGraph } from '@open-pencil/scene-graph'
import { appendAll } from '@open-pencil/scene-graph/arrays'
import { compareOrderKeys } from '@open-pencil/scene-graph/order-keys'

function pushTo(groups: Map<string, string[]>, key: string, id: string): void {
  const group = groups.get(key)
  if (group) group.push(id)
  else groups.set(key, [id])
}

/**
 * A parent's children once a pass has read records of them, which list them in the order the
 * file saved them. A parent the pass made gets that order. A parent the graph already had keeps
 * the order of the children it held, which may be an edit: a page already open, or one loaded
 * only for the components other pages use. Each child the pass added goes where the file saved
 * it among them, by order key: after the held child saved nearest before it, or before the first
 * held child when none is.
 */
export function mergeSavedOrder(
  graph: SceneGraph,
  current: readonly string[],
  saved: readonly string[],
  existing: ReadonlySet<string>
): string[] {
  const savedIds = new Set(saved)
  const held = current.filter((id) => existing.has(id))
  if (held.length === 0) return [...savedIds, ...current.filter((id) => !savedIds.has(id))]
  const keyOf = (id: string) => graph.getNode(id)?.source.orderKey ?? null
  const heldIds = new Set(held)
  const anchors = held
    .flatMap((id) => {
      const key = keyOf(id)
      return key === null ? [] : [{ id, key }]
    })
    .sort((a, b) => compareOrderKeys(a.key, b.key))
  const before = new Map<string, string[]>()
  const after = new Map<string, string[]>()
  const unplaced: string[] = []
  const added = [...savedIds].filter((id) => !heldIds.has(id))
  for (const id of added) {
    const key = keyOf(id)
    if (key === null || anchors.length === 0) {
      unplaced.push(id)
      continue
    }
    // The number of held children saved before this one.
    let below = 0
    let end = anchors.length
    while (below < end) {
      const middle = (below + end) >> 1
      if (compareOrderKeys(anchors[middle].key, key) < 0) below = middle + 1
      else end = middle
    }
    if (below === 0) pushTo(before, anchors[0].id, id)
    else pushTo(after, anchors[below - 1].id, id)
  }
  const byKey = (ids: string[]) =>
    ids.sort((a, b) => compareOrderKeys(keyOf(a) ?? '', keyOf(b) ?? ''))
  const merged: string[] = []
  for (const id of held) {
    appendAll(merged, byKey(before.get(id) ?? []))
    merged.push(id)
    appendAll(merged, byKey(after.get(id) ?? []))
  }
  appendAll(merged, unplaced)
  for (const id of current) if (!heldIds.has(id) && !savedIds.has(id)) merged.push(id)
  return merged
}
