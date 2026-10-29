import {
  COLLAB_ACTIONS,
  createRelayClientAssembler,
  encodeSyncReply,
  decodeRelayClientFrame,
  decodeRoomUpdate,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  relayServerMessages,
  type RelayServerFrame
} from '#cloud/contract'
import * as Y from 'yjs'

import { authorizeRelayTicket, principalKey, type RelayAuthorization } from './authorize'
import { stampAwareness } from './awareness'
import type { CollaborationStateStore } from './persistence'

/** One client's socket, as a runtime adapter hands it to the relay. */
export type RelaySocket = {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
}

/** What the adapter reports back about that socket. */
export type RelayConnection = {
  receive(data: Uint8Array): void
  closed(): void
}

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
  /** How long a room whose last save failed waits before saving again. */
  persistRetryMs?: number
  /** How long a socket may stay open without presenting a ticket. */
  authTimeoutMs?: number
  onError?: (message: string, error: unknown) => void
}

/** Messages a viewer may send; their document writes never leave the relay. */
const VIEWER_ACTIONS = new Set<string>([COLLAB_ACTIONS.syncStep1, COLLAB_ACTIONS.awareness])

type Peer = {
  id: string
  socket: RelaySocket
  authorization: RelayAuthorization
  presenceClients: Set<number>
  expiry?: ReturnType<typeof setTimeout>
}

type Room = {
  id: string
  identity: { documentId: string; roomEpoch: number }
  document: Y.Doc
  peers: Map<string, Peer>
  persistTimer: ReturnType<typeof setTimeout> | null
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
      const kept = rooms.get(authorization.roomId)
      if (kept) return kept
      const document = new Y.Doc()
      const state = await options.store.load(identity)
      if (state) Y.applyUpdate(document, state)
      const room: Room = {
        id: authorization.roomId,
        identity,
        document,
        peers: new Map(),
        persistTimer: null
      }
      document.on('update', () => schedulePersist(room))
      rooms.set(room.id, room)
      return room
    })()
    opening.set(authorization.roomId, created)
    try {
      return await created
    } finally {
      opening.delete(authorization.roomId)
    }
  }

  /** Saves the room's document; false when the store refused it. */
  async function persist(room: Room): Promise<boolean> {
    if (room.persistTimer) clearTimeout(room.persistTimer)
    room.persistTimer = null
    try {
      await options.store.store(room.identity, Y.encodeStateAsUpdate(room.document))
      return true
    } catch (error) {
      report('Saving a collaboration room failed:', error)
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
  function applyToRoom(room: Room, peer: Peer, namespace: string, payload: Uint8Array): boolean {
    try {
      const update = decodeRoomUpdate(payload, {
        limit: MAX_COLLAB_MESSAGE_BYTES,
        compressed: namespace === COLLAB_ACTIONS.syncReply
      })
      if (!update) {
        peer.socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration update is too large')
        return false
      }
      Y.applyUpdateV2(room.document, update, peer.id)
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
    sendAll(
      recipients.flatMap((peer) => (peer ? [peer.socket] : [])),
      frame
    )
  }

  function handleServerMessage(room: Room, peer: Peer, namespace: string, payload: Uint8Array) {
    if (namespace === COLLAB_ACTIONS.syncStep1) {
      let reply: Uint8Array
      try {
        reply = encodeSyncReply(room.document, payload)
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
      applyToRoom(room, peer, namespace, payload)
    }
  }

  function handleMessage(
    room: Room,
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
      for (const clientId of stamped.claimed) peer.presenceClients.add(clientId)
      if (!stamped.update) return
      forwarded = stamped.update
    }

    if (target === RELAY_SERVER_PEER) {
      handleServerMessage(room, peer, namespace, payload)
      return
    }
    if (
      (namespace === COLLAB_ACTIONS.yjsUpdate || namespace === COLLAB_ACTIONS.syncReply) &&
      !applyToRoom(room, peer, namespace, payload)
    ) {
      return
    }
    forward(room, peer, namespace, target, forwarded)
  }

  function scheduleExpiry(peer: Peer) {
    clearTimeout(peer.expiry)
    peer.expiry = setTimeout(
      () => peer.socket.close(RELAY_CLOSE.expired, 'Collaboration ticket expired'),
      Math.max(0, peer.authorization.expiresAt - Date.now())
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
    scheduleExpiry(peer)
    send(socket, {
      type: 'welcome',
      peerId: peer.id,
      peers: [RELAY_SERVER_PEER, ...room.peers.keys()]
    })
    for (const other of room.peers.values()) send(other.socket, { type: 'join', peerId: peer.id })
    room.peers.set(peer.id, peer)
    // Ask for what the newcomer has that the room lacks, such as edits made offline.
    if (authorization.permission === 'edit') {
      send(socket, {
        type: 'message',
        namespace: COLLAB_ACTIONS.syncStep1,
        from: RELAY_SERVER_PEER,
        payload: Y.encodeStateVector(room.document)
      })
    }
    return peer
  }

  async function saveAndClose(room: Room) {
    if ((await persist(room)) || shuttingDown) {
      room.document.destroy()
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
    clearTimeout(peer.expiry)
    const room = rooms.get(peer.authorization.roomId)
    if (!room?.peers.delete(peer.id)) return
    for (const other of room.peers.values()) send(other.socket, { type: 'leave', peerId: peer.id })
    void leaveRoom(room)
  }

  return {
    connect(socket: RelaySocket): RelayConnection {
      let peer: Peer | null = null
      /** Read through an object, since it changes across awaits and between messages. */
      const state = { closed: false, authenticating: false }
      const isClosed = () => state.closed
      const queued: Uint8Array[] = []
      let queuedBytes = 0
      // Only an editor's writes can be large: a viewer's frames, and a peer's before it is
      // admitted, fit in one message, so nobody else can make the relay hold more.
      const assembler = createRelayClientAssembler(() =>
        peer?.authorization.permission === 'edit'
          ? MAX_COLLAB_MESSAGE_BYTES
          : options.maximumMessageBytes
      )
      const authTimer = setTimeout(
        () => socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket'),
        authTimeoutMs
      )

      async function authenticate(token: string) {
        let authorization: RelayAuthorization
        try {
          authorization = await authorizeRelayTicket(token, options.authSecret)
        } catch {
          socket.close(RELAY_CLOSE.unauthorized, 'Invalid collaboration ticket')
          return
        }
        if (options.documentId !== undefined && authorization.documentId !== options.documentId) {
          socket.close(RELAY_CLOSE.unauthorized, 'Ticket is for a different document')
          return
        }
        if (state.closed) return
        if (peer) {
          // A refreshed ticket keeps the peer in its room as the same person; a lowered
          // permission applies from now on.
          const current = peer.authorization
          if (
            authorization.roomId !== current.roomId ||
            principalKey(authorization.principal) !== principalKey(current.principal)
          ) {
            socket.close(RELAY_CLOSE.unauthorized, 'Ticket is for a different room or person')
            return
          }
          peer.authorization = authorization
          scheduleExpiry(peer)
          return
        }
        clearTimeout(authTimer)
        const admitted = await admit(socket, authorization)
        // The socket may have closed while the room loaded.
        if (admitted && isClosed()) depart(admitted)
        else peer = admitted
      }

      function process(data: Uint8Array) {
        if (data.byteLength > options.maximumMessageBytes) {
          socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration message is too large')
          return
        }
        const assembled = assembler.push(data)
        if (assembled.type === 'partial') return
        if (assembled.type === 'too-large') {
          socket.close(RELAY_CLOSE.messageTooLarge, 'Collaboration message is too large')
          return
        }
        const frame = assembled.type === 'frame' ? decodeRelayClientFrame(assembled.data) : null
        if (!frame) {
          socket.close(RELAY_CLOSE.protocol, 'Malformed collaboration frame')
          return
        }
        if (frame.type === 'auth') {
          state.authenticating = true
          void authenticate(frame.token)
            .catch((error: unknown) => {
              report('Admitting a collaboration peer failed:', error)
              socket.close(RELAY_CLOSE.protocol, 'Could not open the collaboration room')
            })
            .finally(() => {
              state.authenticating = false
              flush()
            })
          return
        }
        const room = peer && rooms.get(peer.authorization.roomId)
        if (!peer || !room) {
          socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
          return
        }
        handleMessage(room, peer, frame.namespace, frame.target, frame.payload)
      }

      function flush() {
        while (!state.authenticating && !state.closed && queued.length > 0) {
          const next = queued.shift()
          if (!next) continue
          queuedBytes -= next.byteLength
          process(next)
        }
      }

      return {
        receive(data) {
          if (state.closed) return
          queuedBytes += data.byteLength
          // Before admission a peer has sent its ticket and has nothing else to say, so what
          // waits for the room to open is held to one message's worth.
          if (!peer && queuedBytes > options.maximumMessageBytes) {
            queued.length = 0
            queuedBytes = 0
            socket.close(RELAY_CLOSE.messageTooLarge, 'Too much sent before joining the room')
            return
          }
          queued.push(data)
          flush()
        },
        closed() {
          state.closed = true
          queued.length = 0
          queuedBytes = 0
          clearTimeout(authTimer)
          if (peer) depart(peer)
        }
      }
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
          clearTimeout(peer.expiry)
          peer.socket.close(RELAY_CLOSE.restored, 'The document was restored')
        }
        room.peers.clear()
        room.document.destroy()
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
        [...rooms.values()]
          .filter((room) => room.identity.documentId === documentId)
          .flatMap((room) => [...room.peers.values()].map((peer) => peer.socket)),
        frame
      )
    },

    /** Saves every open room and closes its sockets, as the runtime shuts down. */
    async close() {
      shuttingDown = true
      await Promise.all(
        [...rooms.values()].map(async (room) => {
          for (const peer of room.peers.values()) {
            clearTimeout(peer.expiry)
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
