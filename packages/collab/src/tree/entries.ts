/**
 * A layer's parent history: every parent it has been placed under, each with the move counter
 * of its latest placement there. The entry with the highest counter is where the layer belongs.
 */
export type ParentEntries = ReadonlyMap<string, number>

/** One placement of a layer, as the tree resolution ranks it. */
export interface ParentEdge {
  parentId: string
  counter: number
}

/** Newer placements first; equal counters from concurrent moves fall back to the parent id. */
export function compareEdges(a: ParentEdge, b: ParentEdge): number {
  if (a.counter !== b.counter) return b.counter - a.counter
  if (a.parentId === b.parentId) return 0
  return a.parentId < b.parentId ? 1 : -1
}

export function rankedEdges(entries: ParentEntries): ParentEdge[] {
  return [...entries].map(([parentId, counter]) => ({ parentId, counter })).sort(compareEdges)
}

/** The entry a layer would sit under if nothing stopped it. */
export function topEdge(entries: ParentEntries): ParentEdge | undefined {
  let top: ParentEdge | undefined
  for (const [parentId, counter] of entries) {
    const edge = { parentId, counter }
    if (!top || compareEdges(edge, top) < 0) top = edge
  }
  return top
}

/** Siblings sort by order key, and layers that share a key by id, so every peer agrees. */
export function compareSiblings(
  a: { id: string; orderKey: string | undefined },
  b: { id: string; orderKey: string | undefined }
): number {
  const keyA = a.orderKey ?? ''
  const keyB = b.orderKey ?? ''
  if (keyA !== keyB) return keyA < keyB ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}
