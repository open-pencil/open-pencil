import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

/**
 * The whole records of the slot content Figma keeps on the internal canvas: each content frame
 * and the records below it. Headers find them; only frames on that canvas and their subtrees
 * are decoded whole.
 */
export function savedSlotContent(
  headers: readonly NodeChange[],
  whole: (header: NodeChange) => NodeChange
): NodeChange[] {
  const internal = new Set(
    headers.flatMap((header) =>
      header.type === 'CANVAS' && header.internalOnly && header.guid
        ? [guidToString(header.guid)]
        : []
    )
  )
  const children = new Map<string, NodeChange[]>()
  for (const header of headers) {
    const parent = header.parentIndex?.guid && guidToString(header.parentIndex.guid)
    if (parent) children.set(parent, [...(children.get(parent) ?? []), header])
  }
  const subtree = (header: NodeChange): NodeChange[] => [
    whole(header),
    ...(header.guid ? (children.get(guidToString(header.guid)) ?? []) : []).flatMap(subtree)
  ]
  return [...internal].flatMap((canvas) =>
    (children.get(canvas) ?? [])
      .filter((header) => header.type === 'FRAME' && whole(header).isSlotContent === true)
      .flatMap(subtree)
  )
}
