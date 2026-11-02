import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { derivedSymbolDataOf, symbolDataOf, type SymbolData } from '../instance-overrides/types'

/** One entry of a list addressed by layer path: the fields an edit set on it and dropped. */
export interface FigEntryPatch {
  path: GUID[]
  set: Record<string, unknown>
  unset: string[]
}

/** What an edit changed in a list of entries addressed by layer path. */
export interface FigEntryListPatch {
  /** Entries changed or added, by path. */
  entries: FigEntryPatch[]
  /** Paths whose entries are gone. */
  removed: GUID[][]
}

/**
 * Fields an edit changed in a record the archive holds. The rest of the record stays as the
 * archive saved it, fields OpenPencil does not model included.
 */
export interface FigRecordFieldPatch {
  guid: GUID
  /** Fields written over the archive's. */
  set: Partial<NodeChange>
  /** Fields the record no longer has. */
  unset: string[]
  /**
   * An instance's overrides and the values derived for its layers, changed entry by entry, so
   * the entries an edit did not reach stay as Figma saved them.
   */
  symbolOverrides?: FigEntryListPatch
  derivedSymbolData?: FigEntryListPatch
}

/** A layer path as a key, matching entries across lists. */
export function entryPathKey(path: readonly GUID[] | undefined): string {
  return (path ?? []).map(guidToString).join('/')
}

interface PathEntry {
  guidPath?: { guids?: GUID[] }
}

/** `list` with the patch's entries merged in by path. */
function patchedEntries<Entry extends PathEntry>(
  list: readonly Entry[],
  patch: FigEntryListPatch
): Entry[] {
  const removed = new Set(patch.removed.map(entryPathKey))
  const result = list.filter((entry) => !removed.has(entryPathKey(entry.guidPath?.guids)))
  const at = new Map(result.map((entry, index) => [entryPathKey(entry.guidPath?.guids), index]))
  for (const change of patch.entries) {
    const key = entryPathKey(change.path)
    const index = at.get(key)
    const merged: Record<string, unknown> = {
      ...(index === undefined ? { guidPath: { guids: change.path } } : result[index]),
      ...structuredClone(change.set)
    }
    for (const field of change.unset) Reflect.deleteProperty(merged, field)
    if (index === undefined) {
      at.set(key, result.length)
      result.push(merged as Entry)
    } else result[index] = merged as Entry
  }
  return result
}

/** An archive record with an edit's fields merged in. */
export function patchedRecord(record: NodeChange, patch: FigRecordFieldPatch): NodeChange {
  const merged: NodeChange = { ...record, ...structuredClone(patch.set) }
  for (const field of patch.unset) Reflect.deleteProperty(merged, field)
  const symbolData = symbolDataOf(merged)
  if (patch.symbolOverrides && symbolData) {
    const patched: SymbolData = {
      ...symbolData,
      symbolOverrides: patchedEntries(symbolData.symbolOverrides ?? [], patch.symbolOverrides)
    }
    // The Kiwi codec types only `symbolID`; the record keeps the rest of its symbol fields.
    merged.symbolData = patched as NodeChange['symbolData']
  }
  if (patch.derivedSymbolData)
    merged.derivedSymbolData = patchedEntries(derivedSymbolDataOf(merged), patch.derivedSymbolData)
  return merged
}
