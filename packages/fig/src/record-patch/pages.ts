import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { symbolDataOf, symbolOverridesOf } from '../instance-overrides/types'
import { guidKey } from './entry'
import { scannedRecords } from './scan'

/** The id of the nearest record of `type` from `id` up through its parents, itself included. */
function nearestOfType(
  byId: ReadonlyMap<string, NodeChange>,
  id: string,
  type: string
): string | undefined {
  const seen = new Set<string>()
  for (let current = byId.get(id); current;) {
    const currentId = guidKey(current.guid)
    if (!currentId || seen.has(currentId)) return undefined
    seen.add(currentId)
    if (current.type === type) return currentId
    const parent = guidKey(current.parentIndex?.guid)
    current = parent ? byId.get(parent) : undefined
  }
  return undefined
}

function recordsById(records: readonly NodeChange[]): Map<string, NodeChange> {
  const byId = new Map<string, NodeChange>()
  for (const record of records) {
    const id = guidKey(record.guid)
    if (id) byId.set(id, record)
  }
  return byId
}

/** The page each record is on, by its GUID, through its parents; undefined off every page. */
export function figRecordPages(
  records: readonly NodeChange[],
  ids: readonly string[]
): (string | undefined)[] {
  const byId = recordsById(records)
  return ids.map((id) => nearestOfType(byId, id, 'CANVAS'))
}

/**
 * The pages whose instances use these components, directly or through a component that nests
 * one of them. Their records carry overrides and sizes derived from the components.
 */
export function figComponentUsePages(
  records: readonly NodeChange[],
  componentIds: readonly string[]
): string[] {
  const byId = recordsById(records)
  const instancesOf = new Map<string, string[]>()
  const use = (componentId: string | undefined, instanceId: string) => {
    if (!componentId) return
    const instances = instancesOf.get(componentId) ?? []
    instances.push(instanceId)
    instancesOf.set(componentId, instances)
  }
  for (const record of records) {
    const id = guidKey(record.guid)
    if (!id || record.type !== 'INSTANCE') continue
    use(guidKey(symbolDataOf(record)?.symbolID), id)
    for (const override of symbolOverridesOf(record)) use(guidKey(override.overriddenSymbolID), id)
  }
  const nearest = (id: string, type: string) => nearestOfType(byId, id, type)
  const pages = new Set<string>()
  const visited = new Set<string>()
  const pending = [...componentIds]
  for (let componentId = pending.pop(); componentId !== undefined; componentId = pending.pop()) {
    if (visited.has(componentId)) continue
    visited.add(componentId)
    for (const instanceId of instancesOf.get(componentId) ?? []) {
      const page = nearest(instanceId, 'CANVAS')
      if (page) pages.add(page)
      const owner = nearest(instanceId, 'SYMBOL')
      if (owner) pending.push(owner)
    }
  }
  return [...pages]
}

/** `figComponentUsePages` over an encoded archive, reading only what it needs of each record. */
export function figArchiveComponentUsePages(
  bytes: ArrayBuffer,
  componentIds: readonly string[]
): string[] {
  return figComponentUsePages(scannedRecords(bytes), componentIds)
}

/** Each archive's records by GUID, scanned once: an archive's bytes are never written to. */
const archiveRecordIndexes = new WeakMap<ArrayBuffer, Map<string, NodeChange>>()

/** `figRecordPages` over an encoded archive, reading only what it needs of each record. */
export function figArchiveRecordPages(
  bytes: ArrayBuffer,
  ids: readonly string[]
): (string | undefined)[] {
  let byId = archiveRecordIndexes.get(bytes)
  if (!byId) {
    byId = recordsById(scannedRecords(bytes))
    archiveRecordIndexes.set(bytes, byId)
  }
  const index = byId
  return ids.map((id) => nearestOfType(index, id, 'CANVAS'))
}
