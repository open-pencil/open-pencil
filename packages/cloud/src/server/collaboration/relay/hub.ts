import {
  COLLAB_ACTIONS,
  decodeRelayClientFrame,
  encodeRelayServerFrame,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
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
  maximumMessageBytes: number
  maximumConnectionsPerRoom: number
  /** The participant limit policy sets for a document, or null for none. */
  maximumParticipants?: (documentId: string) => Promise<number | null>
  /** How long after a change the room's document is saved. */
  persistDelayMs?: number
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
  const persistDelayMs = options.persistDelayMs ?? 2_000
  const authTimeoutMs = options.authTimeoutMs ?? 10_000
  const report = options.onError ?? ((message, error) => console.error(`[Cloud] ${message}`, error))

  function send(socket: RelaySocket, frame: RelayServerFrame) {
    socket.send(encodeRelayServerFrame(frame))
  }

  async function openRoom(authorization: RelayAuthorization): Promise<Room> {
    const existing = rooms.get(authorization.roomId)
    if (existing) return existing
    const pending = opening.get(authorization.roomId)
    if (pending) return pending
    const identity = { documentId: authorization.documentId, roomEpoch: authorization.roomEpoch }
    const created = (async () => {
      // A room reopened while its last save is in flight must load what that save writes.
      await closing.get(authorization.roomId)
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

  async function persist(room: Room) {
    if (room.persistTimer) clearTimeout(room.persistTimer)
    room.persistTimer = null
    try {
      await options.store.store(room.identity, Y.encodeStateAsUpdate(room.document))
    } catch (error) {
      report('Saving a collaboration room failed:', error)
    }
  }

  function schedulePersist(room: Room) {
    room.persistTimer ??= setTimeout(() => void persist(room), persistDelayMs)
  }

  function applyToRoom(room: Room, peer: Peer, update: Uint8Array): boolean {
    try {
      Y.applyUpdate(room.document, update, peer.id)
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
    const frame = encodeRelayServerFrame({ type: 'message', namespace, from: from.id, payload })
    if (target) {
      room.peers.get(target)?.socket.send(frame)
      return
    }
    for (const peer of room.peers.values()) if (peer !== from) peer.socket.send(frame)
  }

  function handleServerMessage(room: Room, peer: Peer, namespace: string, payload: Uint8Array) {
    if (namespace === COLLAB_ACTIONS.syncStep1) {
      let reply: Uint8Array
      try {
        reply = Y.encodeStateAsUpdate(room.document, payload)
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
      applyToRoom(room, peer, payload)
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
      !applyToRoom(room, peer, payload)
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
    const room = await openRoom(authorization)
    const limit = await options.maximumParticipants?.(authorization.documentId)
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

  async function leaveRoom(room: Room) {
    if (room.peers.size > 0 || rooms.get(room.id) !== room) return
    rooms.delete(room.id)
    const saved = persist(room).then(() => room.document.destroy())
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
        const frame = decodeRelayClientFrame(data)
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
          if (next) process(next)
        }
      }

      return {
        receive(data) {
          if (state.closed) return
          queued.push(data)
          flush()
        },
        closed() {
          state.closed = true
          clearTimeout(authTimer)
          if (peer) depart(peer)
        }
      }
    },

    /** Saves every open room and closes its sockets, as the runtime shuts down. */
    async close() {
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
