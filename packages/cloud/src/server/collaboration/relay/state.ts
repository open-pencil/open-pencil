import * as Y from 'yjs'

import { encodeSyncReplyFromUpdate } from '@open-pencil/collab'

/** A document with nothing in it, as a V2 update. */
const EMPTY_STATE = Y.encodeStateAsUpdateV2(new Y.Doc())

/**
 * A room's document as the relay holds it: encoded V2 updates, never a `Y.Doc`. A document's
 * structures take about ten times its encoded size in memory, so a room of a few megabytes would
 * not fit beside the others a runtime holds; merging and diffing encoded updates works on the bytes
 * as they stream past, in about the memory of their result.
 *
 * Encoded updates keep what a document deletes until something that holds the document collects
 * it: an editor does, so the relay asks one for its copy now and then (`compactWith`).
 */
export type RoomState = {
  /** The encoded size of what the room holds, which only a compaction shrinks. */
  readonly bytes: number
  /**
   * Whether `update` is a V2 update the relay can read, and whether it adds to the room: one that
   * only deletes what the room holds adds nothing, so it may always join a room at its limit,
   * while deletions of what the room never received wait in it, and count like any other update.
   */
  read(update: Uint8Array): { adds: boolean } | null
  /** Takes a peer's V2 update, which `read` must already have accepted. */
  add(update: Uint8Array): void
  /** Everything the room holds, as one V2 update. */
  encode(): Uint8Array
  /** Which updates the room holds, as a state vector. */
  stateVector(): Uint8Array
  /** What the room holds that a peer with `stateVector` lacks, compressed as sync replies travel. */
  syncReply(stateVector: Uint8Array): Uint8Array
  /**
   * Takes an editor's whole document in place of the room's when it is smaller, adding whatever the
   * room holds that the editor's copy lacks, deletions included, so nothing the room has is lost.
   * Whether the room took it.
   */
  compactWith(document: Uint8Array): boolean
}

/** The room's state from its saved V1 snapshot and the V1 updates logged after it. */
export function roomStateFromSaved(snapshot: Uint8Array | null, updates: Uint8Array[]): RoomState {
  const [first, ...rest] = snapshot ? [snapshot, ...updates] : updates
  if (!first) return createRoomState(EMPTY_STATE)
  // One merge first, so the conversion holds one copy of the room beside its result.
  const merged = rest.length === 0 ? first : Y.mergeUpdates([first, ...rest])
  return createRoomState(Y.convertUpdateFormatV1ToV2(merged))
}

export function createRoomState(initial: Uint8Array): RoomState {
  /** The room as of the last merge, and the updates since, merged in only when something reads it. */
  let base = initial
  let recent: Uint8Array[] = []
  let bytes = initial.byteLength
  /** How far the room holds each client's updates, kept as updates arrive. */
  let held = heldClocks(initial)

  function encode(): Uint8Array {
    if (recent.length > 0) {
      base = Y.mergeUpdatesV2([base, ...recent])
      recent = []
      bytes = base.byteLength
    }
    return base
  }

  return {
    get bytes() {
      return bytes
    },
    read(update) {
      try {
        const { from, to } = Y.parseUpdateMetaV2(update)
        if ([...to].some(([client, clock]) => from.get(client) !== clock)) return { adds: true }
        const { ds } = Y.decodeUpdateV2(update)
        const known = [...ds.clients].every(([client, deletions]) =>
          deletions.every((deletion) => deletion.clock + deletion.len <= (held.get(client) ?? 0))
        )
        return { adds: !known }
      } catch {
        return null
      }
    },
    add(update) {
      recent.push(update)
      bytes += update.byteLength
      for (const [client, clock] of Y.parseUpdateMetaV2(update).to) {
        if (clock > (held.get(client) ?? 0)) held.set(client, clock)
      }
    },
    encode,
    stateVector: () => Y.encodeStateVectorFromUpdateV2(encode()),
    syncReply: (stateVector) => encodeSyncReplyFromUpdate(encode(), stateVector),
    compactWith(document) {
      const current = encode()
      const missing = Y.diffUpdateV2(current, Y.encodeStateVectorFromUpdateV2(document))
      const next = Y.mergeUpdatesV2([document, missing])
      if (next.byteLength >= current.byteLength) return false
      base = next
      bytes = next.byteLength
      held = heldClocks(next)
      return true
    }
  }
}

/** How far an encoded document holds each client's updates. */
const heldClocks = (state: Uint8Array) =>
  Y.decodeStateVector(Y.encodeStateVectorFromUpdateV2(state))

/** A room's state as its store saves it: one V1 update, the format rooms were always saved in. */
export const savedState = (state: RoomState) => Y.convertUpdateFormatV2ToV1(state.encode())

/** Updates as the room's log keeps them: one V1 update for each save. */
export const savedUpdates = (updates: Uint8Array[]) =>
  Y.convertUpdateFormatV2ToV1(Y.mergeUpdatesV2(updates))
