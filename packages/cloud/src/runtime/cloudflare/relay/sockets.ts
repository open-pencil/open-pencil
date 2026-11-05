import { RELAY_CLOSE } from '#cloud/contract'
import {
  readRelayPeerState,
  type CollaborationRelay,
  type RelayConnection,
  type RelaySocket
} from '#cloud/server'

/** What the relay's sockets need from the Durable Object that holds them. */
export type RelaySocketHost = {
  /** The sockets the object still holds, as `DurableObjectState.getWebSockets` lists them. */
  sockets(): WebSocket[]
  /** Creates the relay for the document the object serves, once per wake. */
  createRelay(documentId: string): Promise<CollaborationRelay>
}

/** A socket message's bytes; text is passed on as bytes for the relay to refuse. */
function bytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new TextEncoder().encode(typeof data === 'string' ? data : '')
}

/**
 * A hibernatable socket as the relay sees it. The peer's state rides on the socket as its
 * attachment, so a relay woken from hibernation can resume the peer.
 */
function relaySocket(socket: WebSocket): RelaySocket {
  // A closing socket throws on send and close, which would stop a broadcast to the others.
  const open = () => socket.readyState === WebSocket.OPEN
  return {
    send(data) {
      if (open()) socket.send(data)
    },
    close(code, reason) {
      if (open()) socket.close(code, reason)
    },
    remember(state) {
      socket.serializeAttachment(state)
    }
  }
}

/**
 * The relay a Durable Object wakes to and its sockets' connections to it. Sockets are accepted
 * for hibernation, so an idle object is evicted while they stay open, each keeping its peer; the
 * relay it wakes to resumes them, loading a room's document only once a message needs it.
 */
export function createRelaySockets(host: RelaySocketHost) {
  let relay: Promise<CollaborationRelay> | null = null
  /** Each socket's connection to the relay, since the object last woke. */
  const connections = new Map<WebSocket, RelayConnection>()

  /** The relay, created once per wake; it takes back every socket the object still holds. */
  function open(documentId: string): Promise<CollaborationRelay> {
    const opened = (relay ??= host.createRelay(documentId).then((created) => {
      for (const socket of host.sockets()) {
        if (connections.has(socket)) continue
        const state = readRelayPeerState(socket.deserializeAttachment())
        // A socket the relay never admitted has no peer to resume, and its ticket is long due.
        if (state) connections.set(socket, created.resume(relaySocket(socket), state))
        else socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
      }
      return created
    }))
    opened.catch(() => {
      if (relay === opened) relay = null
    })
    return opened
  }

  /**
   * The socket's connection, waking the relay for the document its peer is in, or null for a
   * stray socket. A socket that closed while the object hibernated may already be missing from
   * the ones the woken relay takes back, so its peer is resumed here, if only to leave.
   */
  async function connectionOf(socket: WebSocket): Promise<RelayConnection | null> {
    const known = connections.get(socket)
    if (known) return known
    const state = readRelayPeerState(socket.deserializeAttachment())
    if (!state) return null
    const woken = await open(state.authorization.documentId)
    const connection = connections.get(socket) ?? woken.resume(relaySocket(socket), state)
    connections.set(socket, connection)
    return connection
  }

  return {
    open,
    /** Whether a relay is awake, or anyone is still connected to wake one for. */
    get active() {
      return relay !== null || host.sockets().length > 0
    },

    /** Connects a socket the object just accepted, which presents its ticket next. */
    accept(socket: WebSocket, woken: CollaborationRelay) {
      connections.set(socket, woken.connect(relaySocket(socket)))
    },

    async message(socket: WebSocket, message: string | ArrayBuffer) {
      const connection = await connectionOf(socket)
      if (connection) connection.receive(bytes(message))
      else socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
    },

    /** Lets the socket's peer leave its room, so the room closes once it empties. */
    async closed(socket: WebSocket) {
      const connection = await connectionOf(socket)
      connections.delete(socket)
      connection?.closed()
    }
  }
}
