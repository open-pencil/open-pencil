import { RELAY_CLOSE } from '#cloud/contract'
import { readPairedTabState, type AgentPairingHub, type RelayConnection } from '#cloud/server'

import { bytes, hibernatableSocket } from './sockets'

/** The hibernation tag of a paired tab's socket, which tells it from a collaboration socket. */
export const PAIRING_SOCKET_TAG = 'agent-pairing'

/** What a paired tab's sockets need from the Durable Object that holds them. */
export type PairingSocketHost = {
  /** The paired tabs' sockets the object still holds. */
  sockets(): WebSocket[]
  /** Creates the hub for the pairing the object serves, once per wake. */
  createHub(pairing: string): Promise<AgentPairingHub>
}

/**
 * A pairing's hub on a Durable Object and its tabs' connections to it. Sockets hibernate with the
 * object, each keeping the tab it is as its attachment, which the hub it wakes to resumes.
 */
export function createPairingSockets(host: PairingSocketHost) {
  let hub: Promise<AgentPairingHub> | null = null
  const connections = new Map<WebSocket, RelayConnection>()

  function open(pairing: string): Promise<AgentPairingHub> {
    const opened = (hub ??= host.createHub(pairing).then((created) => {
      for (const socket of host.sockets()) {
        if (connections.has(socket)) continue
        const state = readPairedTabState(socket.deserializeAttachment())
        // A socket that never presented its token has no tab to resume.
        if (state) connections.set(socket, created.resume(hibernatableSocket(socket), state))
        else socket.close(RELAY_CLOSE.unauthorized, 'Expected a pairing token')
      }
      return created
    }))
    opened.catch(() => {
      if (hub === opened) hub = null
    })
    return opened
  }

  async function connection(socket: WebSocket): Promise<RelayConnection | null> {
    const known = connections.get(socket)
    if (known) return known
    const state = readPairedTabState(socket.deserializeAttachment())
    if (!state) {
      socket.close(RELAY_CLOSE.unauthorized, 'Expected a pairing token')
      return null
    }
    await open(state.pairing)
    return connections.get(socket) ?? null
  }

  return {
    open,
    /** Takes a socket a tab just opened. */
    accept(socket: WebSocket, created: AgentPairingHub) {
      connections.set(socket, created.connect(hibernatableSocket(socket)))
    },
    async message(socket: WebSocket, message: string | ArrayBuffer) {
      ;(await connection(socket))?.receive(bytes(message))
    },
    async closed(socket: WebSocket) {
      ;(await connection(socket))?.closed()
      connections.delete(socket)
    },
    /** Whether any tab of the pairing is connected. */
    get connected(): boolean {
      return host.sockets().length > 0
    }
  }
}
