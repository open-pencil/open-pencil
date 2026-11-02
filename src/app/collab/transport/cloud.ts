import {
  createRelayServerAssembler,
  decodeRelayServerFrame,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  RELAY_FORWARDING_BYTES,
  relayClientMessages,
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
  /**
   * Issues a fresh ticket for the room, on connecting and before the current one expires, or
   * null once the document has moved to another room.
   */
  ticket: (roomId: string) => Promise<CloudRelayTicket | null>
  /** The document was restored to a version and its room started over; this one is done. */
  onRestored?: () => void
  /**
   * The relay turned this peer away for good, and reconnecting cannot help: its ticket or the
   * room refused it, or it sent what the relay will not take.
   */
  onRefused?: () => void
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
  /** Set once the relay or a ticket says the document was restored, which ends the room once. */
  let ended = false
  let attempt = 0
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let ticketExpiresAt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function send(frame: RelayClientFrame) {
    const current = socket
    if (current?.readyState !== WebSocket.OPEN) return
    // A large frame goes as fragments in a row, which the relay joins before reading it.
    for (const message of relayClientMessages(frame)) current.send(message)
  }

  async function refresh() {
    try {
      const next = await options.ticket(roomId)
      if (left) return
      if (!next) {
        restored()
        return
      }
      send({ type: 'auth', token: next.token })
      scheduleRefresh(next)
    } catch (error) {
      report('Refreshing the collaboration ticket failed:', error)
      // Try again while the current ticket still holds, rather than wait for the relay to drop us.
      if (!left && ticketExpiresAt - Date.now() > MINIMUM_REFRESH_MS) {
        refreshTimer = setTimeout(() => void refresh(), MINIMUM_REFRESH_MS)
      }
    }
  }

  function scheduleRefresh(ticket: CloudRelayTicket) {
    clearTimeout(refreshTimer)
    ticketExpiresAt = Date.parse(ticket.expiresAt)
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

  function handleFrame(data: Uint8Array) {
    const frame = decodeRelayServerFrame(data)
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

  /** The room this transport serves is over; whoever opened it moves to the new one. */
  function restored() {
    if (ended) return
    ended = true
    clearTimeout(refreshTimer)
    clearTimeout(reconnectTimer)
    // Nothing more goes to the old room, whoever moves on to the new one.
    const current = socket
    socket = null
    current?.close(1000, 'The document was restored')
    forgetPeers()
    options.onRestored?.()
  }

  async function connect() {
    let ticket: CloudRelayTicket | null
    try {
      ticket = await options.ticket(roomId)
    } catch (error) {
      report('Requesting a collaboration ticket failed:', error)
      reconnect()
      return
    }
    if (left) return
    if (!ticket) {
      restored()
      return
    }
    const issued = ticket
    const next = createSocket(options.url)
    next.binaryType = 'arraybuffer'
    socket = next
    // A socket that was replaced or left behind by `leave()` no longer speaks for this room.
    next.addEventListener('open', () => {
      if (socket !== next) return
      send({ type: 'auth', token: issued.token })
      scheduleRefresh(issued)
    })
    const assembler = createRelayServerAssembler(
      () => MAX_COLLAB_MESSAGE_BYTES + RELAY_FORWARDING_BYTES
    )
    next.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      if (socket !== next) return
      const assembled = assembler.push(new Uint8Array(event.data))
      if (assembled.type === 'frame') handleFrame(assembled.data)
      else if (assembled.type !== 'partial') {
        // A frame this peer could not read leaves it behind the room, so it connects again and
        // syncs what it missed.
        report('The collaboration relay sent a frame this peer cannot read:', assembled.type)
        next.close(1000, 'Unreadable collaboration frame')
      }
    })
    next.addEventListener('close', (event) => {
      if (socket !== next) return
      socket = null
      clearTimeout(refreshTimer)
      forgetPeers()
      if (event.code === RELAY_CLOSE.restored) {
        restored()
        return
      }
      if (FINAL_CLOSE_CODES.has(event.code)) {
        report('The collaboration relay refused this peer:', event.reason || event.code)
        options.onRefused?.()
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
