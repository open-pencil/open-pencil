import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { findWithinBoundary, type TreeShape } from './tree'

/** Archive records indexed by GUID, with children in saved order. */
export interface SourceIndex {
  readonly sources: ReadonlyMap<string, NodeChange>
  readonly children: ReadonlyMap<string, readonly NodeChange[]>
}

/** A record's archive identity, or undefined for the rare record without a GUID. */
export function idOf(record: NodeChange): string | undefined {
  return record.guid ? guidToString(record.guid) : undefined
}

export function parentIdOf(record: NodeChange): string | undefined {
  return record.parentIndex?.guid ? guidToString(record.parentIndex.guid) : undefined
}

/** Records by identity, without the child ordering the full index also builds. */
export function indexRecords(changes: readonly NodeChange[]): Map<string, NodeChange> {
  const sources = new Map<string, NodeChange>()
  for (const change of changes) {
    const id = idOf(change)
    if (id !== undefined) sources.set(id, change)
  }
  return sources
}

/** Saved sibling order: the fractional position string, compared as text. */
export function bySavedPosition(a: NodeChange, b: NodeChange): number {
  const left = a.parentIndex?.position ?? ''
  const right = b.parentIndex?.position ?? ''
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function createSourceIndex(changes: readonly NodeChange[]): SourceIndex {
  const sources = new Map<string, NodeChange>()
  const children = new Map<string, NodeChange[]>()
  for (const change of changes) {
    const id = idOf(change)
    if (id === undefined) continue
    if (sources.has(id)) throw new Error(`Duplicate source node ${id}`)
    sources.set(id, change)
    const parentId = parentIdOf(change)
    if (parentId === undefined) continue
    const siblings = children.get(parentId)
    if (siblings) siblings.push(change)
    else children.set(parentId, [change])
  }
  for (const siblings of children.values()) siblings.sort(bySavedPosition)
  return { sources, children }
}

export function sameGuid(left: GUID | undefined, right: GUID): boolean {
  return left?.sessionID === right.sessionID && left.localID === right.localID
}

export function readOverrideKey(value: unknown): GUID | undefined {
  if (!value || typeof value !== 'object' || !('sessionID' in value) || !('localID' in value))
    return undefined
  if (typeof value.sessionID !== 'number' || typeof value.localID !== 'number') return undefined
  return { sessionID: value.sessionID, localID: value.localID }
}

/** A path segment addresses a record by GUID or by its stable override key. */
export function recordMatches(record: NodeChange, guid: GUID): boolean {
  return sameGuid(record.guid, guid) || sameGuid(readOverrideKey(record.overrideKey), guid)
}

export interface StaticMatch {
  count: number
  /** The single matching record, when exactly one exists. */
  record?: NodeChange
  /** The direct child whose subtree holds that record. */
  topChild?: NodeChange
}

/** Source records as a tree: children by saved order, instances as boundaries. */
export function recordTree({ children }: SourceIndex): TreeShape<NodeChange> {
  return {
    childrenOf: (record) => children.get(idOf(record) ?? '') ?? [],
    isInstance: (record) => record.symbolData?.symbolID !== undefined
  }
}

/**
 * Find a segment among a record's static descendants, searching through ordinary
 * containers but never into an instance.
 */
export function findStaticSegment(index: SourceIndex, parentId: string, guid: GUID): StaticMatch {
  const { count, match, top } = findWithinBoundary(
    index.children.get(parentId) ?? [],
    recordTree(index),
    (record) => recordMatches(record, guid)
  )
  return { count, record: match, topChild: top }
}

/** Whether a path resolves in a component's own source tree, following raw instance links. */
export function resolvesInSourceComponent(
  index: SourceIndex,
  componentId: GUID,
  path: readonly GUID[]
): boolean {
  let sourceId = guidToString(componentId)
  for (const [position, segment] of path.entries()) {
    const source = index.sources.get(sourceId)
    if (!source) return false
    if (position === 0 && recordMatches(source, segment)) continue
    const { record } = findStaticSegment(index, sourceId, segment)
    if (!record) return false
    if (position === path.length - 1) return true
    if (!record.symbolData?.symbolID) return false
    sourceId = guidToString(record.symbolData.symbolID)
  }
  return false
}

/** Follow raw symbol references to the component definition an instance ultimately expands. */
export function terminalComponent(index: SourceIndex, id: string): string {
  let current = id
  const seen = new Set<string>()
  while (!seen.has(current)) {
    seen.add(current)
    const record = index.sources.get(current)
    if (record?.type !== 'INSTANCE' || !record.symbolData?.symbolID) return current
    current = guidToString(record.symbolData.symbolID)
  }
  return current
}
