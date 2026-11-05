import {
  createRelayClientAssembler,
  decodeRelayClientFrame,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  type RelayClientFrame
} from '#cloud/contract'

import { authorizeRelayTicket, principalKey, type RelayAuthorization } from './authorize'
import type { RelayPeerState } from './resume'

/** One client's socket, as a runtime adapter hands it to the relay. */
export type RelaySocket = {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
  /**
   * Keeps the peer's state with the socket, for a runtime that sets the relay aside while sockets
   * stay open and resumes their peers with `resume` when it wakes.
   */
  remember?(state: RelayPeerState): void
}

/** What the adapter reports back about that socket. */
export type RelayConnection = {
  receive(data: Uint8Array): void
  closed(): void
}

/** A socket admitted to a room, as the person and permission its ticket names. */
export type RelayPeer = {
  id: string
  socket: RelaySocket
  authorization: RelayAuthorization
  presenceClients: Set<number>
}

/** A room message from an admitted peer. */
export type RelayRoomFrame = Extract<RelayClientFrame, { type: 'message' }>

/** What a connection asks of the relay it belongs to. */
export type ConnectionRelay = {
  authSecret: string
  /** The one document the relay serves, when it serves one. */
  documentId?: string
  maximumMessageBytes: number
  authTimeoutMs: number
  /** Admits a newcomer whose ticket verified, or turns it away and answers null. */
  admit(socket: RelaySocket, authorization: RelayAuthorization): Promise<RelayPeer | null>
  /** Takes a refreshed ticket for a peer already in its room. */
  refreshed(peer: RelayPeer): void
  /** Handles a peer's room message; a promise while it waits for the room's document. */
  deliver(peer: RelayPeer, frame: RelayRoomFrame): Promise<void> | undefined
  depart(peer: RelayPeer): void
  report(message: string, error: unknown): void
}

/**
 * A socket's connection: a new one, which presents a ticket before it joins, or one resumed with
 * the peer it already is. It joins fragmented frames, holds what arrives while a ticket is checked
 * or the room's document loads, and refreshes tickets.
 */
export function openRelayConnection(
  socket: RelaySocket,
  resumed: RelayPeer | null,
  relay: ConnectionRelay
): RelayConnection {
  let peer: RelayPeer | null = resumed
  /** Read through an object, since it changes across awaits and between messages. */
  const state = { closed: false, busy: false }
  const isClosed = () => state.closed
  const queued: Uint8Array[] = []
  let queuedBytes = 0
  // Only an editor's writes can be large: a viewer's frames, and a peer's before it is
  // admitted, fit in one message, so nobody else can make the relay hold more.
  const assembler = createRelayClientAssembler(() =>
    peer?.authorization.permission === 'edit' ? MAX_COLLAB_MESSAGE_BYTES : relay.maximumMessageBytes
  )
  const authTimer = resumed
    ? undefined
    : setTimeout(
        () => socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket'),
        relay.authTimeoutMs
      )

  async function authenticate(token: string) {
    let authorization: RelayAuthorization
    try {
      authorization = await authorizeRelayTicket(token, relay.authSecret)
    } catch {
      socket.close(RELAY_CLOSE.unauthorized, 'Invalid collaboration ticket')
      return
    }
    if (relay.documentId !== undefined && authorization.documentId !== relay.documentId) {
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
      relay.refreshed(peer)
      return
    }
    clearTimeout(authTimer)
    const admitted = await relay.admit(socket, authorization)
    // The socket may have closed while the room loaded.
    if (admitted && isClosed()) relay.depart(admitted)
    else peer = admitted
  }

  function process(data: Uint8Array) {
    if (data.byteLength > relay.maximumMessageBytes) {
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
      state.busy = true
      void authenticate(frame.token)
        .catch((error: unknown) => {
          relay.report('Admitting a collaboration peer failed:', error)
          socket.close(RELAY_CLOSE.protocol, 'Could not open the collaboration room')
        })
        .finally(() => {
          state.busy = false
          flush()
        })
      return
    }
    if (!peer) {
      socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
      return
    }
    const delivered = relay.deliver(peer, frame)
    if (!delivered) return
    // The room's document is loading; this peer's later messages wait for it.
    state.busy = true
    void delivered.finally(() => {
      state.busy = false
      flush()
    })
  }

  function flush() {
    while (!state.busy && !state.closed && queued.length > 0) {
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
      if (!peer && queuedBytes > relay.maximumMessageBytes) {
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
      if (peer) relay.depart(peer)
    }
  }
}
