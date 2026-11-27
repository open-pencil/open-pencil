import { RELAY_CLOSE, relayServerMessages, type RelayServerFrame } from '#cloud/contract'

import { COLLAB_ACTIONS, decodeRoomUpdate, RELAY_SERVER_PEER } from '@open-pencil/collab'

import type { RelayPeer, RelaySocket } from './connection'
import type { RoomLog } from './log'
import type { RoomState } from './state'

/**
 * What an editor's next sync reply to the relay answers: what it holds that the room lacks, asked
 * as it joined, or its whole copy, asked for a compaction when the room had taken `deletions`.
 */
export type AskedReply = { kind: 'join' } | { kind: 'copy'; deletions: number }

/**
 * A room's document, held encoded (`RoomState`), and the log its saves go to, loaded when a
 * message first needs them.
 */
export type RoomContent = {
  state: RoomState
  log: RoomLog
  /** The room's size when it was loaded or last compacted, which its growth is measured from. */
  compactedBytes: number
  /**
   * How many updates the room took that delete something, which only a compaction lets go of. A
   * loaded room counts one for what its saved state may still hold. A sync reply carries its
   * peer's whole delete set, most of which the room already holds, so one counts only when it
   * also adds something, as work done offline does.
   */
  deletions: number
  /** `deletions` as of the editor's copy the room was last compacted with. */
  compactedDeletions: number
  /**
   * When the relay last asked an editor for its copy of the document, and which editor, until it
   * answers; past `COMPACTION_ANSWER_MS` another editor may be asked, so a tab that stopped
   * answering does not hold the room's compaction.
   */
  compactionAsked: { at: number; peerId: string } | null
  /** What each editor's next sync replies to the relay answer, in order. */
  asked: Map<string, AskedReply[]>
}

export type Room = {
  id: string
  identity: { documentId: string; roomEpoch: number }
  peers: Map<string, RelayPeer>
  persistTimer: ReturnType<typeof setTimeout> | null
  /**
   * Null until a message needs the document: peers resumed after the runtime woke the relay
   * exchange presence without it, so a wake for presence alone loads nothing from the store.
   */
  content: RoomContent | null
  loading: Promise<RoomContent> | null
}

/** A room with no peers whose document has not been loaded. */
export function newRoom(id: string, identity: Room['identity']): Room {
  return { id, identity, peers: new Map(), persistTimer: null, content: null, loading: null }
}

/** Sends a frame to one socket, split into fragments as the relay sends every frame. */
export function send(socket: RelaySocket, frame: RelayServerFrame) {
  for (const message of relayServerMessages(frame)) socket.send(message)
}

/** Sends one frame to every socket, encoding it once. */
export function sendAll(sockets: Iterable<RelaySocket>, frame: RelayServerFrame) {
  const messages = relayServerMessages(frame)
  for (const socket of sockets) for (const message of messages) socket.send(message)
}

/** Whether a room message carries a document update the room applies. */
export const updatesDocument = (namespace: string) =>
  namespace === COLLAB_ACTIONS.yjsUpdate || namespace === COLLAB_ACTIONS.syncReply

/** Whether handling a message reads or writes the room's document. */
export function needsDocument(namespace: string, target: string | null): boolean {
  if (updatesDocument(namespace)) return true
  return target === RELAY_SERVER_PEER && namespace === COLLAB_ACTIONS.syncStep1
}

/**
 * Applies a peer's V2 update to the room, inflated first for a sync reply, closing the peer's
 * socket when it is malformed or would grow the room past `limit`. An update that only deletes
 * what the room holds always fits, so a full room can still be cleared; what it deletes is let go
 * once the room is compacted. Whether the room took it.
 */
export function applyToRoom(
  content: RoomContent,
  peer: RelayPeer,
  namespace: string,
  payload: Uint8Array,
  limit: number
): boolean {
  const update = readPeerUpdate(content.state, peer, namespace, payload, limit)
  if (!update) return false
  if (!fits(content.state, update, limit)) {
    peer.socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration update is too large')
    return false
  }
  content.log.add(update.data)
  if (update.deletes && (namespace === COLLAB_ACTIONS.yjsUpdate || update.adds)) {
    content.deletions += 1
  }
  return true
}

/**
 * Whether `update` leaves the room within `limit`. The room counts each update whole until it
 * merges them, which shares their bookkeeping, so a room past its limit by that count is merged
 * and measured before an update is turned away; one that only deletes what the room holds always
 * fits. Both measures read the whole room, so they run only at the limit.
 */
function fits(state: RoomState, update: PeerUpdate, limit: number) {
  if (state.bytes + update.data.byteLength <= limit) return true
  state.encode()
  if (state.bytes + update.data.byteLength <= limit) return true
  return !update.adds && state.deletesOnlyHeld(update.data)
}

/** A peer's update as the relay read it. */
type PeerUpdate = { data: Uint8Array; adds: boolean; deletes: boolean }

/** A peer's update as the relay reads it, or null once the peer's socket was closed for it. */
function readPeerUpdate(
  state: RoomState,
  peer: RelayPeer,
  namespace: string,
  payload: Uint8Array,
  limit: number
): PeerUpdate | null {
  let data: Uint8Array | null
  try {
    data = decodeRoomUpdate(payload, { limit, compressed: namespace === COLLAB_ACTIONS.syncReply })
  } catch {
    peer.socket.close(RELAY_CLOSE.protocol, 'Malformed document update')
    return null
  }
  if (!data) {
    peer.socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration update is too large')
    return null
  }
  const read = state.read(data)
  if (!read) {
    peer.socket.close(RELAY_CLOSE.protocol, 'Malformed document update')
    return null
  }
  return { data, ...read }
}

/**
 * Handles a message addressed to the relay's own peer: a sync request is answered from the room,
 * and a sync reply is taken into it, or, from the editor asked for its whole copy, compacts it.
 * Whether the room changed.
 */
export function answerAsServer(
  content: RoomContent,
  peer: RelayPeer,
  namespace: string,
  payload: Uint8Array,
  limit: number
): boolean {
  if (namespace === COLLAB_ACTIONS.syncStep1) {
    let reply: Uint8Array
    try {
      reply = content.state.syncReply(payload)
    } catch {
      peer.socket.close(RELAY_CLOSE.protocol, 'Malformed state vector')
      return false
    }
    send(peer.socket, {
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      from: RELAY_SERVER_PEER,
      payload: reply
    })
    return false
  }
  if (namespace !== COLLAB_ACTIONS.syncReply) return false
  const asked = content.asked.get(peer.id)
  const answers = asked?.shift()
  if (asked?.length === 0) content.asked.delete(peer.id)
  if (answers?.kind !== 'copy') return applyToRoom(content, peer, namespace, payload, limit)
  const compacted = compactWithCopy(content, payload, limit)
  // A copy that did not shrink the room counts too, so the relay asks again only once it grew
  // and deleted more.
  content.compactedBytes = content.state.bytes
  // A late answer, after the relay asked another editor, holds only the deletions of its own ask.
  content.compactedDeletions = Math.max(content.compactedDeletions, answers.deletions)
  if (content.compactionAsked?.peerId === peer.id) content.compactionAsked = null
  return compacted
}

/**
 * Compacts the room with an editor's compressed copy of the document. The relay asked for it, so
 * a copy it cannot read, or one past the room's limit, is dropped rather than held against the
 * editor; the room stays as it was.
 */
function compactWithCopy(content: RoomContent, payload: Uint8Array, limit: number): boolean {
  try {
    const copy = decodeRoomUpdate(payload, { limit, compressed: true })
    return copy !== null && content.log.compactWith(copy)
  } catch {
    return false
  }
}
