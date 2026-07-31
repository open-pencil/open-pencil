import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'

export function guidKey(guid: GUID | undefined): string | null {
  if (!guid) return null
  return `${guid.sessionID}:${guid.localID}`
}

export function nodeKey(nc: NodeChange): string | null {
  return guidKey(nc.guid)
}

/**
 * Figma fractional-index positions are ordered by raw code-unit value, not by
 * locale collation. `localeCompare` applies ICU variable weighting to the ASCII
 * punctuation/symbol range these keys live in ('!'..'~'), which scrambles them
 * (e.g. '$'.localeCompare('%') === 1). Compare code units instead.
 */
export function comparePosition(a: string | undefined, b: string | undefined): number {
  const left = a ?? ''
  const right = b ?? ''
  if (left < right) return -1
  return left > right ? 1 : 0
}

export function nextLocalId(nodes: Iterable<NodeChange>): number {
  let max = 0
  for (const nc of nodes) {
    const local = nc.guid?.localID
    if (typeof local === 'number' && local > max) max = local
  }
  return max + 1
}
