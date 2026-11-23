import type { FigSlotContent } from '@open-pencil/fig'
import { mapBlobIndices } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { GUID } from '@open-pencil/scene-graph/primitives'

interface SlotValue {
  varValue?: { value?: { slotContentIdValue?: { guid?: GUID } } }
}

/** What the pinned schema's `symbolData` leaves out: the overrides of nested instances. */
interface SymbolOverrides {
  symbolID?: GUID
  symbolOverrides?: Array<{ componentPropAssignments?: SlotValue[] }>
}

/** The slot content frames a record's own assignments and its overrides' assignments name. */
function assignedContent(record: NodeChange): string[] {
  const assignments = [
    ...((record.componentPropAssignments ?? []) as SlotValue[]),
    ...((record.symbolData as SymbolOverrides | undefined)?.symbolOverrides ?? []).flatMap(
      (override) => override.componentPropAssignments ?? []
    )
  ]
  return assignments.flatMap((assignment) => {
    const guid = assignment.varValue?.value?.slotContentIdValue?.guid
    return guid ? [guidToString(guid)] : []
  })
}

/**
 * The saved slot content the written records assign but do not hold, as when an instance's
 * variant has no frame to show it: each content frame from the file, placed on `canvas` after
 * what is there, with the records below it as they were. Content a kept record assigns is kept
 * too, and the blobs kept records cite join `blobs`.
 */
export function savedSlotContentFor(
  written: readonly NodeChange[],
  saved: FigSlotContent,
  canvas: GUID,
  position: () => string,
  blobs: Uint8Array[]
): NodeChange[] {
  const writtenIds = new Set(
    written.flatMap((record) => (record.guid ? [guidToString(record.guid)] : []))
  )
  const missing = new Set<string>()
  const assign = (record: NodeChange) => {
    for (const id of assignedContent(record)) if (!writtenIds.has(id)) missing.add(id)
  }
  for (const record of written) assign(record)
  const blobIndex = new Map<number, number>()
  const cite = (index: number) => {
    const known = blobIndex.get(index)
    if (known !== undefined) return known
    blobIndex.set(index, blobs.length)
    blobs.push(saved.blobs[index] ?? new Uint8Array())
    return blobs.length - 1
  }
  const kept = new Set<string>()
  const records: NodeChange[] = []
  // Each pass keeps what the last one assigned; records come parent first, so one pass keeps a
  // frame's whole subtree.
  for (let grew = true; grew;) {
    grew = false
    for (const record of saved.records) {
      const id = record.guid && guidToString(record.guid)
      if (!id || writtenIds.has(id) || kept.has(id)) continue
      const parent = record.parentIndex?.guid && guidToString(record.parentIndex.guid)
      const root = missing.has(id)
      if (!root && !(parent && kept.has(parent))) continue
      kept.add(id)
      grew = true
      assign(record)
      const own = mapBlobIndices(record, cite)
      records.push(root ? { ...own, parentIndex: { guid: canvas, position: position() } } : own)
    }
  }
  return records
}
