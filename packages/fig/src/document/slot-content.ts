import { groupBy } from 'es-toolkit'

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
  // Records without a parent group under '', which no record's GUID spells.
  const children = groupBy(headers, (header) =>
    header.parentIndex ? guidToString(header.parentIndex.guid) : ''
  )
  const subtree = (header: NodeChange): NodeChange[] => [
    whole(header),
    ...(header.guid ? (children[guidToString(header.guid)] ?? []) : []).flatMap(subtree)
  ]
  return [...internal].flatMap((canvas) =>
    (children[canvas] ?? [])
      .filter((header) => header.type === 'FRAME' && whole(header).isSlotContent === true)
      .flatMap(subtree)
  )
}
