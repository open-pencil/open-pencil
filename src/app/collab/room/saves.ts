import type * as Y from 'yjs'

import { readCounter } from '@/app/collab/shared-tree/fields'

/** How many edits each peer's client has made to a room's document. */
export type EditCounts = ReadonlyMap<string, number>

const EDITS_KEY = 'edits'
const SAVED_KEY = 'saved'

function readCounts(map: Y.Map<unknown>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [client, value] of map.entries()) {
    const count = readCounter(value)
    if (count !== undefined) counts.set(client, count)
  }
  return counts
}

/** Whether `counts` holds an edit that `saved` does not. */
function hasEditsBeyond(counts: EditCounts, saved: EditCounts): boolean {
  return [...counts].some(([client, count]) => count > (saved.get(client) ?? 0))
}

/**
 * What of a room's document its stored revisions hold, so a tab that opens the stored document
 * can tell the room's copy from an edit. Each peer counts its own edits to the document's content
 * under its client in `edits`; whoever saves copies the counts its upload held into `saved`. The
 * room has unsaved edits while any client has more edits than `saved` records.
 */
export function trackRoomSaves(ydoc: Y.Doc, content: readonly object[]) {
  const edits = ydoc.getMap<unknown>(EDITS_KEY)
  const saved = ydoc.getMap<unknown>(SAVED_KEY)
  const client = String(ydoc.clientID)
  const handlers = new Set<() => void>()

  // A count written here is a transaction of its own, which Yjs runs right after this one.
  const countEdit = (transaction: Y.Transaction) => {
    if (!transaction.local) return
    const changed: ReadonlyMap<object, unknown> = transaction.changedParentTypes
    if (!content.some((type) => changed.has(type))) return
    edits.set(client, (readCounter(edits.get(client)) ?? 0) + 1)
  }
  const notify = () => {
    for (const handler of handlers) handler()
  }
  ydoc.on('afterTransaction', countEdit)
  edits.observe(notify)
  saved.observe(notify)

  return {
    counts: (): EditCounts => readCounts(edits),
    /** Whether the room holds edits no stored revision has. */
    unsaved: () => hasEditsBeyond(readCounts(edits), readCounts(saved)),
    /** Records that a stored revision now holds the edits `counts` counted. */
    markSaved(counts: EditCounts) {
      const current = readCounts(saved)
      if (!hasEditsBeyond(counts, current)) return
      ydoc.transact(() => {
        for (const [client, count] of counts) {
          if (count > (current.get(client) ?? 0)) saved.set(client, count)
        }
      })
    },
    /** Follows edits and saves from anyone; returns the unsubscribe. */
    onChange(handler: () => void): () => void {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    dispose() {
      ydoc.off('afterTransaction', countEdit)
      edits.unobserve(notify)
      saved.unobserve(notify)
      handlers.clear()
    }
  }
}

export type RoomSaves = Omit<ReturnType<typeof trackRoomSaves>, 'dispose'>
