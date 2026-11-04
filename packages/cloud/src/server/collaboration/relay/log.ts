import * as Y from 'yjs'

import type { CollaborationRoomIdentity, CollaborationStateStore } from './persistence'

/** When a room folds its log into a fresh snapshot: after this many updates or bytes logged. */
export type RoomLogLimits = { updates: number; bytes: number }

export type RoomLog = {
  /**
   * Saves what the document took since the last save: one merged update in the log, or a snapshot
   * in the log's place once it reaches its limits, as the room closes, or after a failed save.
   * Saves run one at a time; a refused one rejects, and the next save writes a snapshot.
   */
  save(options?: { closing?: boolean }): Promise<void>
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

  /** Updates since the last save, which the next one logs. */
  let pending: Uint8Array[] = []
  document.on('update', (update: Uint8Array) => pending.push(update))
  /** The last sequence a save may have written: an append that failed may still have landed. */
  let sequence = saved.sequence
  let loggedCount = saved.updates.length
  let loggedBytes = saved.updates.reduce((total, update) => total + update.byteLength, 0)
  /** Set by a failed save, after which only a snapshot is sure to hold the room. */
  let compactNext = false
  /** The save in flight; the next one waits for it, so two never claim one sequence. */
  let saving: Promise<void> = Promise.resolve()

  async function write(closing: boolean) {
    const compact =
      compactNext ||
      loggedCount >= limits.updates ||
      loggedBytes >= limits.bytes ||
      (closing && (loggedCount > 0 || pending.length > 0))
    // Updates that arrive while this save is in flight go to the next one.
    const batch = pending
    pending = []
    if (compact) {
      await store.compact(room, sequence, Y.encodeStateAsUpdate(document))
      loggedCount = 0
      loggedBytes = 0
      compactNext = false
    } else if (batch.length > 0) {
      const update = Y.mergeUpdates(batch)
      sequence += 1
      await store.append(room, sequence, update)
      loggedCount += 1
      loggedBytes += update.byteLength
    }
  }

  const log: RoomLog = {
    save({ closing = false } = {}) {
      const run = saving.then(() => write(closing))
      saving = run.catch(() => {
        compactNext = true
      })
      return run
    }
  }
  return { document, log }
}
