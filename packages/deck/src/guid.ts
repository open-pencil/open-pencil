import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'

export function guidKey(guid: GUID | undefined): string | null {
  if (!guid) return null
  return `${guid.sessionID}:${guid.localID}`
}

export function nodeKey(nc: NodeChange): string | null {
  return guidKey(nc.guid)
}

export function comparePosition(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '')
}

export function nextLocalId(nodes: Iterable<NodeChange>): number {
  let max = 0
  for (const nc of nodes) {
    const local = nc.guid?.localID
    if (typeof local === 'number' && local > max) max = local
  }
  return max + 1
}
