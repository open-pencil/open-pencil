import * as Y from 'yjs'

import type { CollaborationRoomIdentity, CollaborationStateStore } from './persistence'

/** When a room folds its log into a fresh snapshot: after this many updates or bytes logged. */
export type RoomLogLimits = { updates: number; bytes: number }

export type RoomLog = {
  /** Takes an update the room's document applied, for the next save. */
  record(update: Uint8Array): void
  /**
   * Saves what the room took since the last save: one merged update in the log, or a snapshot in
   * the log's place once it reaches its limits, as the room closes, or after a failed save.
   * Saves run one at a time. Throws when the store refused it; what it held is kept for the next
   * save.
   */
  save(document: Y.Doc, options?: { closing?: boolean }): Promise<void>
}

/**
 * A room's document as its store saved it, its snapshot with the updates logged after it, and the
 * log its saves go to. Each room has one writer, the relay holding it, so sequences only grow.
 */
export async function openRoomLog(
  store: CollaborationStateStore,
  room: CollaborationRoomIdentity,
  limits: RoomLogLimits
): Promise<{ document: Y.Doc; log: RoomLog }> {
  const saved = await store.load(room)
  const document = new Y.Doc()
  if (saved.snapshot) Y.applyUpdate(document, saved.snapshot)
  for (const update of saved.updates) Y.applyUpdate(document, update)

  let pending: Uint8Array[] = []
  let sequence = saved.sequence
  let logged = {
    count: saved.updates.length,
    bytes: saved.updates.reduce((total, update) => total + update.byteLength, 0)
  }
  /**
   * Set when a write failed: whether it landed is unknown, so the next save writes a snapshot,
   * which holds the room whatever the store kept, rather than logging the sequence again.
   */
  let compactNext = false
  /**
   * Set when an append failed: its row may have landed, so the snapshot covers that sequence too,
   * and the next append takes the one after it.
   */
  let appendUnknown = false
  /** The save in flight; the next one waits for it, so two never claim one sequence. */
  let saving: Promise<void> = Promise.resolve()

  async function saveNow(current: Y.Doc, closing: boolean) {
    const compact =
      compactNext ||
      logged.count >= limits.updates ||
      logged.bytes >= limits.bytes ||
      (closing && (logged.count > 0 || pending.length > 0))
    if (pending.length === 0 && !compact) return
    // Updates that arrive while this save is in flight go to the next one.
    const batch = pending
    pending = []
    try {
      if (compact) {
        // The snapshot holds the whole room, this batch included, through the last logged update.
        const through = appendUnknown ? sequence + 1 : sequence
        await store.compact(room, through, Y.encodeStateAsUpdate(current))
        sequence = through
        logged = { count: 0, bytes: 0 }
        compactNext = false
        appendUnknown = false
      } else {
        const update = Y.mergeUpdates(batch)
        try {
          await store.append(room, sequence + 1, update)
        } catch (error) {
          appendUnknown = true
          throw error
        }
        sequence += 1
        logged = { count: logged.count + 1, bytes: logged.bytes + update.byteLength }
      }
    } catch (error) {
      pending = [...batch, ...pending]
      compactNext = true
      throw error
    }
  }

  const log: RoomLog = {
    record(update) {
      pending.push(update)
    },

    save(current, { closing = false } = {}) {
      const run = saving.then(() => saveNow(current, closing))
      saving = run.catch(() => undefined)
      return run
    }
  }
  return { document, log }
}
