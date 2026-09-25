import type { GUID } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { InstanceOccurrence, InstancePathDiagnostic } from './interpret'
import { sameGuid } from './source-index'
import { descendants, findWithinBoundary, type TreeShape } from './tree'

export const OCCURRENCE_TREE: TreeShape<InstanceOccurrence> = {
  childrenOf: (node) => node.children,
  isInstance: (node) => node.mainComponentId !== null
}

/** Every occurrence below and including `root`, including those inside nested instances. */
export function occurrences(root: InstanceOccurrence): Generator<InstanceOccurrence> {
  return descendants(root, (node) => node.children)
}

export class InstancePathError extends Error {
  constructor(
    readonly diagnostic: InstancePathDiagnostic,
    message: string
  ) {
    super(message)
    this.name = 'InstancePathError'
  }
}

export class SegmentError extends Error {
  constructor(
    readonly count: number,
    guid: GUID
  ) {
    super(`Expected one instance-path target for ${guidToString(guid)}; found ${count}`)
    this.name = 'SegmentError'
  }
}

export function pathError(
  ownerId: string,
  mainComponentId: string | null,
  path: readonly GUID[],
  cause: SegmentError
): InstancePathError {
  return new InstancePathError(
    {
      ownerId,
      mainComponentId,
      path: structuredClone(path),
      reason: cause.count === 0 ? 'missing-target' : 'ambiguous-target'
    },
    `Override declared by ${ownerId}, path [${path.map(guidToString).join(', ')}]: ${cause.message}`
  )
}

/** Search through ordinary containers, but never cross an instance boundary implicitly. */
export function findSegment(root: InstanceOccurrence, guid: GUID): InstanceOccurrence {
  const id = guidToString(guid)
  const { count, match } = findWithinBoundary(
    root.children,
    OCCURRENCE_TREE,
    (node) => sameGuid(node.overrideKey, guid) || node.sourceId === id
  )
  if (!match) throw new SegmentError(count, guid)
  return match
}

export function isRootGuid(owner: InstanceOccurrence, guid: GUID): boolean {
  return (
    sameGuid(owner.properties.symbolData?.symbolID, guid) ||
    sameGuid(owner.mainComponentOverrideKey, guid) ||
    sameGuid(owner.sourceComponentOverrideKey, guid) ||
    sameGuid(owner.sourceComponentId, guid)
  )
}

export function resolveOccurrencePath(
  owner: InstanceOccurrence,
  path: readonly GUID[]
): InstanceOccurrence {
  let target = owner
  for (const [index, guid] of path.entries()) {
    if (index === 0 && isRootGuid(owner, guid)) continue
    target = findSegment(target, guid)
  }
  return target
}
