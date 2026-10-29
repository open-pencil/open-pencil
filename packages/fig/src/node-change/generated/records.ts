import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/**
 * A generated frame's record carries its sublayers as partial records, addressed by paths of one
 * virtual GUID in this session, numbered in template order. `nodeGenerationData` holds what a
 * user set on each, `derivedImmutableFrameData` the layout Figma computed from it.
 */
export const GENERATED_SESSION_ID = 40_000_000

export interface GeneratedEntry extends NodeChange {
  guidPath?: { guids?: GUID[] }
}

interface GeneratedEntryList {
  overrides?: GeneratedEntry[]
}

export function generatedSlotPath(slot: number): { guids: GUID[] } {
  return { guids: [{ sessionID: GENERATED_SESSION_ID, localID: slot }] }
}

function slotOf(entry: GeneratedEntry): number | undefined {
  const guids = entry.guidPath?.guids
  if (guids?.length !== 1 || guids[0].sessionID !== GENERATED_SESSION_ID) return undefined
  return guids[0].localID
}

function bySlot(list: GeneratedEntryList | undefined): Map<number, GeneratedEntry> {
  const entries = new Map<number, GeneratedEntry>()
  for (const entry of list?.overrides ?? []) {
    const slot = slotOf(entry)
    if (slot !== undefined) entries.set(slot, entry)
  }
  return entries
}

/** What a user set on each sublayer, by slot. */
export function generationOverridesOf(record: NodeChange): Map<number, GeneratedEntry> {
  return bySlot(record.nodeGenerationData as GeneratedEntryList | undefined)
}

/** The layout Figma derived for each sublayer, by slot. */
export function derivedFrameEntriesOf(record: NodeChange): Map<number, GeneratedEntry> {
  return bySlot(record.derivedImmutableFrameData as GeneratedEntryList | undefined)
}
