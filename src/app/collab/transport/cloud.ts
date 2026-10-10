import {
  decodeRelayServerFrame,
  encodeRelayClientFrame,
  RELAY_CLOSE,
  type RelayClientFrame
} from '@open-pencil/cloud/contract'

import { createActionRegistry } from './actions'
import type { CollabRoomTransport, JoinCollabRoom } from './types'

/** The relay announces everyone in the room in its welcome, so nobody is still on the way. */
const RELAY_DISCOVERY_MS = 1000
/** How long before a ticket expires the transport presents a fresh one. */
const TICKET_REFRESH_LEAD_MS = 60_000
const MINIMUM_REFRESH_MS = 5_000
const MAXIMUM_RECONNECT_MS = 30_000

/** A collaboration ticket the relay accepts, as the Cloud API issues it. */
export type CloudRelayTicket = { token: string; expiresAt: string }

export type CloudRelayOptions = {
  /** The relay's WebSocket URL from the ticket. */
  url: string
  /** Issues a fresh ticket for the room, on connecting and before the current one expires. */
  ticket: (roomId: string) => Promise<CloudRelayTicket>
  createSocket?: (url: string) => WebSocket
  /** How long to wait before reconnection attempt `attempt`, counting from zero. */
  reconnectDelayMs?: (attempt: number) => number
  onError?: (message: string, error: unknown) => void
}

/** Close codes after which reconnecting cannot help: the ticket or the room refused this peer. */
const FINAL_CLOSE_CODES = new Set<number>([
  RELAY_CLOSE.unauthorized,
  RELAY_CLOSE.roomFull,
  RELAY_CLOSE.messageTooLarge,
  RELAY_CLOSE.protocol
])

function defaultReconnectDelay(attempt: number): number {
  return Math.min(MAXIMUM_RECONNECT_MS, 1000 * 2 ** attempt)
}

/**
 * Joins rooms through an OpenPencil Cloud relay. The relay is a peer too: it holds the room's
 * document, so a newcomer gets it without anyone else online, and it drops writes from viewers.
 */
export function createCloudRelayJoin(options: CloudRelayOptions): JoinCollabRoom {
  return (roomId) => joinCloudRelayRoom(roomId, options)
}

function joinCloudRelayRoom(roomId: string, options: CloudRelayOptions): CollabRoomTransport {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url))
  const reconnectDelay = options.reconnectDelayMs ?? defaultReconnectDelay
  const report =
    options.onError ?? ((message, error) => console.error(`[Collab] ${message}`, error))
  const actions = createActionRegistry((namespace, payload, target) => {
    // Before the welcome there is nobody to reach; the relay asks for missed edits on join.
    if (welcomed) send({ type: 'message', namespace, target: target ?? null, payload })
  })
  const peers = new Set<string>()
  let joinHandler: ((peerId: string) => void) | null = null
  let leaveHandler: ((peerId: string) => void) | null = null
  let socket: WebSocket | null = null
  let welcomed = false
  let left = false
  let attempt = 0
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function send(frame: RelayClientFrame) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(encodeRelayClientFrame(frame))
  }

  async function refresh() {
    try {
      const next = await options.ticket(roomId)
      if (left) return
      send({ type: 'auth', token: next.token })
      scheduleRefresh(next)
    } catch (error) {
      report('Refreshing the collaboration ticket failed:', error)
    }
  }

  function scheduleRefresh(ticket: CloudRelayTicket) {
    clearTimeout(refreshTimer)
    const delay = Math.max(
      MINIMUM_REFRESH_MS,
      Date.parse(ticket.expiresAt) - Date.now() - TICKET_REFRESH_LEAD_MS
    )
    refreshTimer = setTimeout(() => void refresh(), delay)
  }

  function forgetPeers() {
    welcomed = false
    const departed = Array.from(peers)
    peers.clear()
    for (const peerId of departed) leaveHandler?.(peerId)
  }

  function addPeer(peerId: string) {
    if (peers.has(peerId)) return
    peers.add(peerId)
    joinHandler?.(peerId)
  }

  function handleFrame(data: ArrayBuffer) {
    const frame = decodeRelayServerFrame(new Uint8Array(data))
    if (!frame) return
    switch (frame.type) {
      case 'welcome':
        welcomed = true
        attempt = 0
        for (const peerId of frame.peers) addPeer(peerId)
        return
      case 'join':
        addPeer(frame.peerId)
        return
      case 'leave':
        if (peers.delete(frame.peerId)) leaveHandler?.(frame.peerId)
        return
      case 'message':
        actions.deliver(frame.namespace, frame.payload, frame.from)
    }
  }

  function reconnect() {
    if (left) return
    reconnectTimer = setTimeout(() => void connect(), reconnectDelay(attempt))
    attempt += 1
  }

  async function connect() {
    let ticket: CloudRelayTicket
    try {
      ticket = await options.ticket(roomId)
    } catch (error) {
      report('Requesting a collaboration ticket failed:', error)
      reconnect()
      return
    }
    if (left) return
    const next = createSocket(options.url)
    next.binaryType = 'arraybuffer'
    socket = next
    next.addEventListener('open', () => {
      send({ type: 'auth', token: ticket.token })
      scheduleRefresh(ticket)
    })
    next.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => handleFrame(event.data))
    next.addEventListener('close', (event) => {
      if (socket !== next) return
      socket = null
      clearTimeout(refreshTimer)
      forgetPeers()
      if (FINAL_CLOSE_CODES.has(event.code)) {
        report('The collaboration relay refused this peer:', event.reason || event.code)
        return
      }
      reconnect()
    })
  }

  void connect()

  return {
    makeAction: actions.makeAction,
    onPeerJoin(handler) {
      joinHandler = handler
      for (const peerId of peers) queueMicrotask(() => handler(peerId))
    },
    onPeerLeave(handler) {
      leaveHandler = handler
    },
    signalingConnected: () => welcomed && socket?.readyState === WebSocket.OPEN,
    discoveryMs: RELAY_DISCOVERY_MS,
    media: null,
    async leave() {
      if (left) return
      left = true
      clearTimeout(refreshTimer)
      clearTimeout(reconnectTimer)
      actions.clear()
      peers.clear()
      const current = socket
      socket = null
      current?.close(1000, 'Left the room')
    }
  }
}
