import {
  COLLAB_ACTIONS,
  encodeSyncReply,
  decodeRoomUpdate,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  relayServerMessages,
  type RelayServerFrame
} from '#cloud/contract'
import * as Y from 'yjs'

import type { RelayAuthorization } from './authorize'
import { stampAwareness } from './awareness'
import {
  openRelayConnection,
  type ConnectionRelay,
  type RelayConnection,
  type RelayPeer,
  type RelayRoomFrame,
  type RelaySocket
} from './connection'
import { openRoomLog, type RoomLog } from './log'
import type { CollaborationStateStore } from './persistence'
import type { RelayPeerState } from './resume'

export type { RelayConnection, RelaySocket } from './connection'

export type CollaborationRelayOptions = {
  authSecret: string
  store: CollaborationStateStore
  /**
   * The one document this relay serves, for runtimes that run a relay per document; tickets for
   * any other document are refused.
   */
  documentId?: string
  /**
   * The most one socket message may carry. An editor's larger frames arrive as fragments joined
   * up to `MAX_COLLAB_MESSAGE_BYTES`; anyone else's frame must fit in one message.
   */
  maximumMessageBytes: number
  maximumConnectionsPerRoom: number
  /** The participant limit policy sets for a document, or null for none. */
  maximumParticipants?: (documentId: string) => Promise<number | null>
  /**
   * The document's current collaboration epoch, which a restore advances; a ticket for an earlier
   * room is turned away so nobody rejoins the document as it was.
   */
  currentRoomEpoch?: (documentId: string) => Promise<number | null>
  /** How long after a change the room's document is saved. */
  persistDelayMs?: number
  /**
   * How many logged updates, or how many of their bytes, a room saves before it writes a fresh
   * snapshot in their place; a closing room always does.
   */
  compactAfterUpdates?: number
  compactAfterBytes?: number
  /** How long a room whose last save failed waits before saving again. */
  persistRetryMs?: number
  /** How long a socket may stay open without presenting a ticket. */
  authTimeoutMs?: number
  onError?: (message: string, error: unknown) => void
}

/** Messages a viewer may send; their document writes never leave the relay. */
const VIEWER_ACTIONS = new Set<string>([COLLAB_ACTIONS.syncStep1, COLLAB_ACTIONS.awareness])

type Peer = RelayPeer

/** A room's document and the log its saves go to, loaded when a message first needs them. */
type RoomContent = { document: Y.Doc; log: RoomLog }

type Room = {
  id: string
  identity: { documentId: string; roomEpoch: number }
  peers: Map<string, Peer>
  persistTimer: ReturnType<typeof setTimeout> | null
  /**
   * Null until a message needs the document: peers resumed after the runtime woke the relay
   * exchange presence without it, so a wake for presence alone loads nothing from the store.
   */
  content: RoomContent | null
  loading: Promise<RoomContent> | null
}

export type CollaborationRelay = ReturnType<typeof createCollaborationRelay>

/**
 * A runtime-neutral relay for collaboration rooms. It forwards room messages between peers and
 * joins every room as a peer itself: it holds the room's document, answers sync requests from
 * it, saves it, drops document writes from viewers, and stamps presence with verified identity.
 */
export function createCollaborationRelay(options: CollaborationRelayOptions) {
  const rooms = new Map<string, Room>()
  const opening = new Map<string, Promise<Room>>()
  /** Rooms whose last peer left and whose document is still being saved. */
  const closing = new Map<string, Promise<void>>()
  /** Set by `close()`: a failed save then drops the room instead of retrying. */
  let shuttingDown = false
  const persistDelayMs = options.persistDelayMs ?? 2_000
  const persistRetryMs = options.persistRetryMs ?? 30_000
  const logLimits = {
    updates: options.compactAfterUpdates ?? 500,
    bytes: options.compactAfterBytes ?? 4 * 1024 * 1024
  }
  const authTimeoutMs = options.authTimeoutMs ?? 10_000
  const report = options.onError ?? ((message, error) => console.error(`[Cloud] ${message}`, error))

  function send(socket: RelaySocket, frame: RelayServerFrame) {
    for (const message of relayServerMessages(frame)) socket.send(message)
  }

  function sendAll(sockets: Iterable<RelaySocket>, frame: RelayServerFrame) {
    const messages = relayServerMessages(frame)
    for (const socket of sockets) for (const message of messages) socket.send(message)
  }

  async function openRoom(authorization: RelayAuthorization): Promise<Room> {
    const existing = rooms.get(authorization.roomId)
    if (existing) return existing
    const pending = opening.get(authorization.roomId)
    if (pending) return pending
    const identity = { documentId: authorization.documentId, roomEpoch: authorization.roomEpoch }
    const created = (async () => {
      // A room reopened while its last save is in flight must load what that save writes, or,
      // when the save failed, take the room it kept.
      await closing.get(authorization.roomId)
      // A room resumed without its document loads it in place; a new one joins the rooms once
      // loaded, so a restore while it loads finds nothing to end and the epoch check turns it away.
      const room = rooms.get(authorization.roomId) ?? newRoom(authorization.roomId, identity)
      await contentOf(room)
      if (!rooms.has(room.id)) rooms.set(room.id, room)
      return room
    })()
    opening.set(authorization.roomId, created)
    try {
      return await created
    } finally {
      opening.delete(authorization.roomId)
    }
  }

  function newRoom(id: string, identity: Room['identity']): Room {
    return { id, identity, peers: new Map(), persistTimer: null, content: null, loading: null }
  }

  /** The room's document and log, loaded from the store the first time something needs them. */
  function contentOf(room: Room): Promise<RoomContent> {
    if (room.content) return Promise.resolve(room.content)
    room.loading ??= openRoomLog(options.store, room.identity, logLimits).then(
      (content) => {
        content.document.on('update', () => schedulePersist(room))
        room.content = content
        return content
      },
      (error: unknown) => {
        room.loading = null
        throw error
      }
    )
    return room.loading
  }

  /** Saves what changed in the room since its last save; false when the store refused it. */
  async function persist(room: Room, closing = false): Promise<boolean> {
    if (room.persistTimer) clearTimeout(room.persistTimer)
    room.persistTimer = null
    // A room nobody needed the document of since it was resumed has nothing new to save.
    if (!room.content) return true
    try {
      await room.content.log.save({ closing })
      return true
    } catch (error) {
      report('Saving a collaboration room failed:', error)
      // The room holds edits the store doesn't have; save again without waiting for another edit.
      // A closing room retries through `saveAndClose`.
      if (!closing && rooms.get(room.id) === room) {
        room.persistTimer ??= setTimeout(() => void persist(room), persistRetryMs)
      }
      return false
    }
  }

  function schedulePersist(room: Room) {
    room.persistTimer ??= setTimeout(() => void persist(room), persistDelayMs)
  }

  /**
   * Applies a peer's V2 update to the room, inflated first for a sync reply. Rooms are saved as
   * V1 updates; only what peers exchange is V2.
   */
  function applyToRoom(
    document: Y.Doc,
    peer: Peer,
    namespace: string,
    payload: Uint8Array
  ): boolean {
    try {
      const update = decodeRoomUpdate(payload, {
        limit: MAX_COLLAB_MESSAGE_BYTES,
        compressed: namespace === COLLAB_ACTIONS.syncReply
      })
      if (!update) {
        peer.socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration update is too large')
        return false
      }
      Y.applyUpdateV2(document, update, peer.id)
      return true
    } catch {
      peer.socket.close(RELAY_CLOSE.protocol, 'Malformed document update')
      return false
    }
  }

  function forward(
    room: Room,
    from: Peer,
    namespace: string,
    target: string | null,
    payload: Uint8Array
  ) {
    const frame: RelayServerFrame = { type: 'message', namespace, from: from.id, payload }
    const recipients = target
      ? [room.peers.get(target)]
      : [...room.peers.values()].filter((peer) => peer !== from)
    sendAll(deliverable(recipients.flatMap((peer) => (peer ? [peer] : []))), frame)
  }

  function handleServerMessage(
    document: Y.Doc,
    peer: Peer,
    namespace: string,
    payload: Uint8Array
  ) {
    if (namespace === COLLAB_ACTIONS.syncStep1) {
      let reply: Uint8Array
      try {
        reply = encodeSyncReply(document, payload)
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
      applyToRoom(document, peer, namespace, payload)
    }
  }

  /** Whether handling a message reads or writes the room's document. */
  function needsDocument(namespace: string, target: string | null): boolean {
    if (namespace === COLLAB_ACTIONS.yjsUpdate || namespace === COLLAB_ACTIONS.syncReply)
      return true
    return target === RELAY_SERVER_PEER && namespace === COLLAB_ACTIONS.syncStep1
  }

  function handleMessage(
    room: Room,
    document: Y.Doc | null,
    peer: Peer,
    namespace: string,
    target: string | null,
    payload: Uint8Array
  ) {
    const readOnly = peer.authorization.permission === 'view'
    if (readOnly && !VIEWER_ACTIONS.has(namespace)) return
    // Only the server says the history changed.
    if (namespace === COLLAB_ACTIONS.versions) return

    let forwarded = payload
    if (namespace === COLLAB_ACTIONS.awareness) {
      const stamped = stampAwareness(payload, peer.authorization, (clientId) =>
        [...room.peers.values()].some(
          (other) => other !== peer && other.presenceClients.has(clientId)
        )
      )
      const known = peer.presenceClients.size
      for (const clientId of stamped.claimed) peer.presenceClients.add(clientId)
      if (peer.presenceClients.size !== known) remember(peer)
      if (!stamped.update) return
      forwarded = stamped.update
    }

    if (target === RELAY_SERVER_PEER) {
      if (document) handleServerMessage(document, peer, namespace, payload)
      return
    }
    if (
      (namespace === COLLAB_ACTIONS.yjsUpdate || namespace === COLLAB_ACTIONS.syncReply) &&
      !(document && applyToRoom(document, peer, namespace, payload))
    ) {
      return
    }
    forward(room, peer, namespace, target, forwarded)
  }

  /**
   * Whether the peer's ticket still holds, closing its socket when it lapsed. It is checked when
   * the relay hears from the peer and before it sends the peer anything, never by a timer, so a
   * runtime can set an idle relay aside while sockets stay open.
   */
  function current(peer: Peer): boolean {
    if (Date.now() < peer.authorization.expiresAt) return true
    peer.socket.close(RELAY_CLOSE.expired, 'Collaboration ticket expired')
    return false
  }

  /** The sockets of peers whose tickets still hold. */
  function deliverable(peers: Iterable<Peer>): RelaySocket[] {
    return [...peers].filter(current).map((peer) => peer.socket)
  }

  function remember(peer: Peer) {
    peer.socket.remember?.({
      peerId: peer.id,
      authorization: peer.authorization,
      presenceClients: [...peer.presenceClients]
    })
  }

  /** Handles a room message from an admitted peer; a promise while the room's document loads. */
  function deliver(peer: Peer, frame: RelayRoomFrame): Promise<void> | undefined {
    const room = rooms.get(peer.authorization.roomId)
    if (!room) {
      peer.socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
      return undefined
    }
    if (!current(peer)) return undefined
    const { namespace, target, payload } = frame
    if (room.content || !needsDocument(namespace, target)) {
      handleMessage(room, room.content?.document ?? null, peer, namespace, target, payload)
      return undefined
    }
    return contentOf(room).then(
      ({ document }) => {
        // The peer may have left while the document loaded.
        if (room.peers.get(peer.id) !== peer) return undefined
        handleMessage(room, document, peer, namespace, target, payload)
        return undefined
      },
      (error: unknown) => {
        report('Loading a collaboration room failed:', error)
        peer.socket.close(RELAY_CLOSE.protocol, 'Could not open the collaboration room')
      }
    )
  }

  async function admit(
    socket: RelaySocket,
    authorization: RelayAuthorization
  ): Promise<Peer | null> {
    const limit = await options.maximumParticipants?.(authorization.documentId)
    let room: Room
    let epoch: number | null | undefined
    // The room's last peer may have left while it opened, or a restore ended it; a closed room
    // takes no newcomers. The epoch is read once the room is open, so a restore cannot slip between.
    do {
      room = await openRoom(authorization)
      epoch = await options.currentRoomEpoch?.(authorization.documentId)
    } while (rooms.get(room.id) !== room)
    if (epoch != null && authorization.roomEpoch < epoch) {
      socket.close(RELAY_CLOSE.restored, 'The document was restored')
      if (room.peers.size === 0) await leaveRoom(room)
      return null
    }
    const capacity = Math.min(limit ?? Number.POSITIVE_INFINITY, options.maximumConnectionsPerRoom)
    if (room.peers.size >= capacity) {
      socket.close(RELAY_CLOSE.roomFull, 'Collaboration room is full')
      if (room.peers.size === 0) await leaveRoom(room)
      return null
    }
    const peer: Peer = {
      id: crypto.randomUUID(),
      socket,
      authorization,
      presenceClients: new Set()
    }
    remember(peer)
    send(socket, {
      type: 'welcome',
      peerId: peer.id,
      peers: [RELAY_SERVER_PEER, ...room.peers.keys()]
    })
    sendAll(deliverable(room.peers.values()), { type: 'join', peerId: peer.id })
    room.peers.set(peer.id, peer)
    // Ask for what the newcomer has that the room lacks, such as edits made offline.
    if (authorization.permission === 'edit') {
      const { document } = await contentOf(room)
      send(socket, {
        type: 'message',
        namespace: COLLAB_ACTIONS.syncStep1,
        from: RELAY_SERVER_PEER,
        payload: Y.encodeStateVector(document)
      })
    }
    return peer
  }

  async function saveAndClose(room: Room) {
    if ((await persist(room, true)) || shuttingDown) {
      room.content?.document.destroy()
      return
    }
    // The room holds edits the store doesn't have: keep it for whoever joins next, and save
    // again later, closing it once a save lands while nobody is in it.
    rooms.set(room.id, room)
    room.persistTimer = setTimeout(() => {
      void (room.peers.size > 0 ? persist(room) : leaveRoom(room))
    }, persistRetryMs)
  }

  async function leaveRoom(room: Room) {
    if (room.peers.size > 0 || rooms.get(room.id) !== room) return
    rooms.delete(room.id)
    const saved = saveAndClose(room)
    closing.set(room.id, saved)
    try {
      await saved
    } finally {
      if (closing.get(room.id) === saved) closing.delete(room.id)
    }
  }

  function depart(peer: Peer) {
    const room = rooms.get(peer.authorization.roomId)
    if (!room?.peers.delete(peer.id)) return
    sendAll(deliverable(room.peers.values()), { type: 'leave', peerId: peer.id })
    void leaveRoom(room)
  }

  /**
   * A socket's connection: a new one, which presents a ticket before it joins, or one resumed with
   * the peer it already is.
   */
  const connectionRelay: ConnectionRelay = {
    authSecret: options.authSecret,
    documentId: options.documentId,
    maximumMessageBytes: options.maximumMessageBytes,
    authTimeoutMs,
    admit,
    refreshed: remember,
    deliver,
    depart,
    report
  }

  return {
    connect(socket: RelaySocket): RelayConnection {
      return openRelayConnection(socket, null, connectionRelay)
    },

    /**
     * Takes back a socket whose peer was admitted before the runtime set the relay aside, as the
     * peer it was, without loading the room's document until a message needs it. A peer whose
     * ticket lapsed meanwhile is closed.
     */
    resume(socket: RelaySocket, saved: RelayPeerState): RelayConnection {
      const { authorization } = saved
      const identity = { documentId: authorization.documentId, roomEpoch: authorization.roomEpoch }
      let room = rooms.get(authorization.roomId)
      if (!room) {
        room = newRoom(authorization.roomId, identity)
        rooms.set(room.id, room)
      }
      const peer: Peer = {
        id: saved.peerId,
        socket,
        authorization,
        presenceClients: new Set(saved.presenceClients)
      }
      room.peers.set(peer.id, peer)
      const connection = openRelayConnection(socket, peer, connectionRelay)
      // After the runtime holds the connection, which its socket's close reports to.
      queueMicrotask(() => current(peer))
      return connection
    },

    /**
     * Ends a restored document's rooms: everyone in them is told the document was restored, and
     * their edits to the replaced state are dropped rather than saved.
     */
    startOver(documentId: string) {
      // A map's iteration carries on past entries deleted during it.
      for (const room of rooms.values()) {
        if (room.identity.documentId !== documentId) continue
        rooms.delete(room.id)
        if (room.persistTimer) clearTimeout(room.persistTimer)
        for (const peer of room.peers.values()) {
          peer.socket.close(RELAY_CLOSE.restored, 'The document was restored')
        }
        room.peers.clear()
        room.content?.document.destroy()
      }
    },

    /** Tells everyone in a document's rooms that its version history changed. */
    announceVersions(documentId: string) {
      const frame: RelayServerFrame = {
        type: 'message',
        namespace: COLLAB_ACTIONS.versions,
        from: RELAY_SERVER_PEER,
        payload: new Uint8Array()
      }
      sendAll(
        deliverable(
          [...rooms.values()]
            .filter((room) => room.identity.documentId === documentId)
            .flatMap((room) => [...room.peers.values()])
        ),
        frame
      )
    },

    /** Saves every open room and closes its sockets, as the runtime shuts down. */
    async close() {
      shuttingDown = true
      await Promise.all(
        [...rooms.values()].map(async (room) => {
          for (const peer of room.peers.values()) {
            peer.socket.close(1001, 'Server shutting down')
          }
          room.peers.clear()
          await leaveRoom(room)
        })
      )
      // Rooms whose last peer left just before, or during, shutdown are still saving.
      await Promise.all(closing.values())
    }
  }
}
