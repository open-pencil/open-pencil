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
 * what is there, with the records below it as they were.
 */
export function savedSlotContentFor(
  written: readonly NodeChange[],
  saved: readonly NodeChange[],
  canvas: GUID,
  position: () => string
): NodeChange[] {
  const writtenIds = new Set(
    written.flatMap((record) => (record.guid ? [guidToString(record.guid)] : []))
  )
  const missing = new Set(written.flatMap(assignedContent).filter((id) => !writtenIds.has(id)))
  const kept = new Set<string>()
  const records: NodeChange[] = []
  for (const record of saved) {
    const id = record.guid && guidToString(record.guid)
    const parent = record.parentIndex?.guid && guidToString(record.parentIndex.guid)
    if (!id || writtenIds.has(id)) continue
    if (missing.has(id)) {
      kept.add(id)
      records.push({ ...record, parentIndex: { guid: canvas, position: position() } })
    } else if (parent && kept.has(parent)) {
      kept.add(id)
      records.push(record)
    }
  }
  return records
}
