import { sumBy } from 'es-toolkit'

import type { CollaborationRoomIdentity, CollaborationStateStore } from './persistence'
import { roomStateFromSaved, savedState, savedUpdates, type RoomState } from './state'

/**
 * When a room folds its log into a fresh snapshot: after this many updates or bytes logged, though a
 * large room waits for more bytes (see `LOG_SHARE`).
 */
export type RoomLogLimits = { updates: number; bytes: number }

/**
 * The share of its snapshot a room's log reaches before the log's bytes, or the room closing, fold
 * it. A fold writes the whole room again, so it is never spent on a small change.
 */
const LOG_SHARE = 0.25

export type RoomLog = {
  /** Takes a peer's V2 update into the room, for the next save to log. */
  add(update: Uint8Array): void
  /**
   * Saves what the room took since the last save: one merged update in the log, or a snapshot in
   * the log's place once it reaches its limits, as a room with enough logged closes, after a
   * failed save, or after an editor's copy compacted the room.
   * Saves run one at a time; a refused one rejects, and the next save writes a snapshot.
   */
  save(options?: { closing?: boolean }): Promise<void>
  /**
   * Takes an editor's whole document in place of the room's when it is smaller (see
   * `RoomState.compactWith`), for the next save to write as the snapshot. Whether it took it.
   */
  compactWith(document: Uint8Array): boolean
}

/**
 * A room's state as its store saved it, its snapshot with the updates logged after it, and the
 * log its saves go to. Each room has one writer, the relay holding it, so sequences only grow.
 */
export async function openRoomLog(
  store: CollaborationStateStore,
  room: CollaborationRoomIdentity,
  limits: RoomLogLimits
): Promise<{ state: RoomState; log: RoomLog }> {
  const saved = await store.load(room)
  const state = roomStateFromSaved(saved.snapshot, saved.updates)

  /** Updates since the last save, which the next one logs. */
  let pending: Uint8Array[] = []
  /** The last sequence a save may have written: an append that failed may still have landed. */
  let sequence = saved.sequence
  let loggedCount = saved.updates.length
  let loggedBytes = saved.updates.reduce((total, update) => total + update.byteLength, 0)
  let snapshotBytes = saved.snapshot?.byteLength ?? 0
  /** Set by a failed save, after which only a snapshot is sure to hold the room. */
  let compactNext = false
  /** The save in flight; the next one waits for it, so two never claim one sequence. */
  let saving: Promise<void> = Promise.resolve()

  async function write(closing: boolean) {
    const share = snapshotBytes * LOG_SHARE
    const unfolded = loggedBytes + sumBy(pending, (update) => update.byteLength)
    const compact =
      compactNext ||
      loggedCount >= limits.updates ||
      loggedBytes >= Math.max(limits.bytes, share) ||
      (closing && unfolded > 0 && unfolded >= share)
    // Updates that arrive while this save is in flight go to the next one, as does a compaction
    // asked for meanwhile; a failed save asks for one again.
    const batch = pending
    pending = []
    compactNext = false
    if (compact) {
      const snapshot = savedState(state)
      await store.compact(room, sequence, snapshot)
      snapshotBytes = snapshot.byteLength
      loggedCount = 0
      loggedBytes = 0
    } else if (batch.length > 0) {
      const update = savedUpdates(batch)
      sequence += 1
      await store.append(room, sequence, update)
      loggedCount += 1
      loggedBytes += update.byteLength
    }
  }

  const log: RoomLog = {
    add(update) {
      state.add(update)
      pending.push(update)
    },
    compactWith(document) {
      if (!state.compactWith(document)) return false
      compactNext = true
      return true
    },
    save({ closing = false } = {}) {
      const run = saving.then(() => write(closing))
      saving = run.catch(() => {
        compactNext = true
      })
      return run
    }
  }
  return { state, log }
}
