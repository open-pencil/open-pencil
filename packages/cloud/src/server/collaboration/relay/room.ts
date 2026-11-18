import {
  COLLAB_ACTIONS,
  decodeRoomUpdate,
  encodeSyncReply,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  relayServerMessages,
  type RelayServerFrame
} from '#cloud/contract'
import * as Y from 'yjs'

import type { RelayPeer, RelaySocket } from './connection'
import type { RoomLog } from './log'

/**
 * A room's document and the log its saves go to, loaded when a message first needs them, with an
 * upper bound on the document's size: what was saved plus every update since. The bound is
 * measured again only once it reaches `maximumRoomBytes` after something was deleted, since only
 * a deletion can leave the document smaller than the bound.
 */
export type RoomContent = {
  document: Y.Doc
  log: RoomLog
  bytes: number
  deletedSinceMeasure: boolean
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

/** Whether `update` adds nothing and deletes only content `document` already holds. */
function deletesOnlyKnown(document: Y.Doc, update: Uint8Array): boolean {
  const { from, to } = Y.parseUpdateMetaV2(update)
  if (![...to].every(([client, clock]) => from.get(client) === clock)) return false
  const { ds } = Y.decodeUpdateV2(update)
  for (const [client, deletions] of ds.clients) {
    const held = Y.getState(document.store, client)
    if (deletions.some((deletion) => deletion.clock + deletion.len > held)) return false
  }
  return true
}

/**
 * Whether the room's document stays within `limit` after `update`. An update that only deletes
 * what the room holds shrinks it, so it always fits; one that deletes what the room has not
 * received waits in the document, so it counts like any other. Otherwise the bound grows by the
 * update; past the limit, the document is measured only if a deletion may have shrunk it since
 * the last measure, so edits near the limit never encode the whole document each time.
 */
function fits(content: RoomContent, update: Uint8Array, limit: number): boolean {
  if (deletesOnlyKnown(content.document, update)) return true
  if (content.bytes + update.byteLength <= limit) return true
  if (!content.deletedSinceMeasure) return false
  content.bytes = Y.encodeStateAsUpdateV2(content.document).byteLength
  content.deletedSinceMeasure = false
  return content.bytes + update.byteLength <= limit
}

/**
 * Applies a peer's V2 update to the room, inflated first for a sync reply, closing the peer's
 * socket when it is malformed or would grow the document past `limit`. Rooms are saved as V1
 * updates; only what peers exchange is V2.
 */
export function applyToRoom(
  content: RoomContent,
  peer: RelayPeer,
  namespace: string,
  payload: Uint8Array,
  limit: number
): boolean {
  const { document } = content
  try {
    const update = decodeRoomUpdate(payload, {
      limit,
      compressed: namespace === COLLAB_ACTIONS.syncReply
    })
    if (!update || !fits(content, update, limit)) {
      peer.socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration update is too large')
      return false
    }
    Y.applyUpdateV2(document, update, peer.id)
    content.bytes += update.byteLength
    return true
  } catch {
    peer.socket.close(RELAY_CLOSE.protocol, 'Malformed document update')
    return false
  }
}

/**
 * Handles a message addressed to the relay's own peer: a sync request is answered from the
 * room's document, and a sync reply is applied to it.
 */
export function answerAsServer(
  content: RoomContent,
  peer: RelayPeer,
  namespace: string,
  payload: Uint8Array,
  limit: number
) {
  if (namespace === COLLAB_ACTIONS.syncStep1) {
    let reply: Uint8Array
    try {
      reply = encodeSyncReply(content.document, payload)
    } catch {
      peer.socket.close(RELAY_CLOSE.protocol, 'Malformed state vector')
      return
    }
    send(peer.socket, {
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      from: RELAY_SERVER_PEER,
      payload: reply
    })
  } else if (namespace === COLLAB_ACTIONS.syncReply) {
    applyToRoom(content, peer, namespace, payload, limit)
  }
}
