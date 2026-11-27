import * as Y from 'yjs'

import { encodeSyncReplyFromUpdate } from '@open-pencil/collab'

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
   * Whether `update` is a V2 update the relay can read, whether it adds structures, and whether it
   * deletes any. The relay reads the whole update once, so one cut short is turned away here
   * rather than failing every merge after it.
   */
  read(update: Uint8Array): { adds: boolean; deletes: boolean } | null
  /**
   * Whether a delete-only update deletes only what the room holds, measured on the merged room:
   * such an update may join a room at its limit, while deletions of what the room never received
   * wait in it and count like any other update.
   */
  deletesOnlyHeld(update: Uint8Array): boolean
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
   * Whether the room took it. A copy no smaller than the room is turned away unread, since what
   * the room adds to it only grows it.
   */
  compactWith(document: Uint8Array): boolean
}

/** The room's state from its saved V1 snapshot and the V1 updates logged after it. */
export function roomStateFromSaved(snapshot: Uint8Array | null, updates: Uint8Array[]): RoomState {
  const [first, ...rest] = snapshot ? [snapshot, ...updates] : updates
  // A document with nothing in it, made here: a Worker may not make one while its module loads.
  if (!first) return createRoomState(Y.encodeStateAsUpdateV2(new Y.Doc()))
  // One merge first, so the conversion holds one copy of the room beside its result.
  const merged = rest.length === 0 ? first : Y.mergeUpdates([first, ...rest])
  return createRoomState(Y.convertUpdateFormatV1ToV2(merged))
}

export function createRoomState(initial: Uint8Array): RoomState {
  /** The room as of the last merge, and the updates since, merged in only when something reads it. */
  let base = initial
  let recent: Uint8Array[] = []
  let bytes = initial.byteLength
  /** The state vector of `base`, read once for each merge: every editor joining asks for it. */
  let held: Uint8Array | null = null

  function replace(next: Uint8Array) {
    base = next
    bytes = next.byteLength
    held = null
  }

  function encode(): Uint8Array {
    if (recent.length > 0) {
      replace(Y.mergeUpdatesV2([base, ...recent]))
      recent = []
    }
    return base
  }

  function stateVector(): Uint8Array {
    const current = encode()
    held ??= Y.encodeStateVectorFromUpdateV2(current)
    return held
  }

  return {
    get bytes() {
      return bytes
    },
    read(update) {
      try {
        const { from, to } = Y.parseUpdateMetaV2(update)
        // Reading an update's structures stops short of its deletions. Cutting every structure
        // away reads the whole update and leaves only its deletions: as a V1 update, two zero
        // counts when it has none.
        const deletions = Y.convertUpdateFormatV2ToV1(
          Y.diffUpdateV2(update, Y.encodeStateVector(to))
        )
        return {
          adds: [...to].some(([client, clock]) => from.get(client) !== clock),
          deletes: deletions.byteLength > 2
        }
      } catch {
        return null
      }
    },
    deletesOnlyHeld(update) {
      // A state vector counts each client's updates from its first without a gap, so it names
      // only what the room holds.
      const clocks = Y.decodeStateVector(stateVector())
      const { ds } = Y.decodeUpdateV2(update)
      return [...ds.clients].every(([client, deletions]) =>
        deletions.every((deletion) => deletion.clock + deletion.len <= (clocks.get(client) ?? 0))
      )
    },
    add(update) {
      recent.push(update)
      bytes += update.byteLength
    },
    encode,
    stateVector,
    syncReply: (stateVector) => encodeSyncReplyFromUpdate(encode(), stateVector),
    compactWith(document) {
      const current = encode()
      if (document.byteLength >= current.byteLength) return false
      const missing = Y.diffUpdateV2(current, Y.encodeStateVectorFromUpdateV2(document))
      const next = Y.mergeUpdatesV2([document, missing])
      if (next.byteLength >= current.byteLength) return false
      replace(next)
      return true
    }
  }
}

/** A room's state as its store saves it: one V1 update, the format rooms were always saved in. */
export const savedState = (state: RoomState) => Y.convertUpdateFormatV2ToV1(state.encode())

/** Updates as the room's log keeps them: one V1 update for each save. */
export const savedUpdates = (updates: Uint8Array[]) =>
  Y.convertUpdateFormatV2ToV1(Y.mergeUpdatesV2(updates))
