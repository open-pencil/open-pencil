import { describe, expect, jest, test } from 'bun:test'

import {
  createRelayClientAssembler,
  decodeRelayClientFrame,
  RELAY_CLOSE,
  RELAY_FRAGMENT_BYTES,
  relayServerMessages,
  type RelayClientFrame,
  type RelayServerFrame
} from '@open-pencil/cloud/contract'

import { createCloudRelayJoin } from '@/app/collab/transport/cloud'

import { asDouble } from '#tests/helpers/doubles'

/** A socket the test opens, feeds, and closes by hand. */
class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING
  binaryType = 'blob'
  readonly sent: RelayClientFrame[] = []
  /** Socket messages sent, which outnumber frames once a frame travels in fragments. */
  messages = 0
  private readonly assembler = createRelayClientAssembler(() => Infinity)

  send(data: Uint8Array) {
    this.messages++
    const assembled = this.assembler.push(data)
    const frame = assembled.type === 'frame' ? decodeRelayClientFrame(assembled.data) : null
    if (frame) this.sent.push(frame)
  }

  open() {
    this.readyState = WebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  receive(frame: RelayServerFrame) {
    for (const data of relayServerMessages(frame)) {
      this.dispatchEvent(new MessageEvent('message', { data: data.slice().buffer }))
    }
  }

  /** Delivers bytes as one socket message, whatever they hold. */
  receiveMessage(data: Uint8Array) {
    this.dispatchEvent(new MessageEvent('message', { data: data.slice().buffer }))
  }

  close(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new CloseEvent('close', { code, reason }))
  }
}

async function settle() {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

function room(
  options: {
    failTicket?: (attempt: number) => boolean
    /** The document moved to another room by this ticket request. */
    movedAt?: number
  } = {}
) {
  const sockets: FakeSocket[] = []
  let tickets = 0
  let restored = 0
  const errors: unknown[] = []
  const join = createCloudRelayJoin({
    url: 'wss://cloud.example.com/api/collaboration/relay',
    ticket: async () => {
      tickets += 1
      if (options.failTicket?.(tickets)) throw new Error('Ticket endpoint unavailable')
      if (options.movedAt !== undefined && tickets >= options.movedAt) return null
      return { token: `ticket-${tickets}`, expiresAt: new Date(Date.now() + 300_000).toISOString() }
    },
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return asDouble<WebSocket>(socket)
    },
    reconnectDelayMs: () => 0,
    onError: (_message, error) => errors.push(error),
    onRestored: () => {
      restored += 1
    }
  })
  const transport = join('cloud:room:0')
  const joined: string[] = []
  const left: string[] = []
  transport.onPeerJoin((peerId) => joined.push(peerId))
  transport.onPeerLeave((peerId) => left.push(peerId))
  return {
    transport,
    sockets,
    joined,
    left,
    errors,
    tickets: () => tickets,
    restored: () => restored
  }
}

describe('Cloud relay transport', () => {
  test('presents its ticket, then reports the peers the relay announces', async () => {
    const { transport, sockets, joined } = room()
    await settle()
    const socket = sockets[0]
    if (!socket) throw new Error('Expected a socket')
    socket.open()
    expect(socket.sent).toEqual([{ type: 'auth', token: 'ticket-1' }])
    expect(transport.signalingConnected()).toBe(false)

    socket.receive({ type: 'welcome', peerId: 'me', peers: ['server', 'alice'] })
    socket.receive({ type: 'join', peerId: 'bob' })
    expect(joined).toEqual(['server', 'alice', 'bob'])
    expect(transport.signalingConnected()).toBe(true)
    await transport.leave()
  })

  test('sends only once welcomed, and delivers messages by namespace and sender', async () => {
    const { transport, sockets } = room()
    const [send, receive] = transport.makeAction('yjs-update')
    const received: [number[], string][] = []
    receive((data, peerId) => received.push([[...data], peerId]))
    await settle()
    const socket = sockets[0]
    if (!socket) throw new Error('Expected a socket')
    socket.open()
    send(new Uint8Array([1]))
    socket.receive({ type: 'welcome', peerId: 'me', peers: ['server'] })
    send(new Uint8Array([2]), 'server')
    socket.receive({
      type: 'message',
      namespace: 'yjs-update',
      from: 'alice',
      payload: new Uint8Array([3])
    })
    socket.receive({
      type: 'message',
      namespace: 'other',
      from: 'alice',
      payload: new Uint8Array([4])
    })

    expect(socket.sent.slice(1)).toEqual([
      { type: 'message', namespace: 'yjs-update', target: 'server', payload: new Uint8Array([2]) }
    ])
    expect(received).toEqual([[[3], 'alice']])
    await transport.leave()
  })

  test('sends and receives frames larger than one message in fragments', async () => {
    const { transport, sockets } = room()
    const [send, receive] = transport.makeAction('yjs-update')
    const received: Uint8Array[] = []
    receive((data) => received.push(data))
    await settle()
    const socket = sockets[0]
    if (!socket) throw new Error('Expected a socket')
    socket.open()
    socket.receive({ type: 'welcome', peerId: 'me', peers: ['server'] })
    const payload = crypto.getRandomValues(new Uint8Array(RELAY_FRAGMENT_BYTES * 3))
    const before = socket.messages
    send(payload)
    expect(socket.messages - before).toBeGreaterThan(1)
    expect(socket.sent.at(-1)).toEqual({
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload
    })
    socket.receive({ type: 'message', namespace: 'yjs-update', from: 'alice', payload })
    expect(received).toEqual([payload])
  })

  test('connects again after a frame it cannot read, to sync what it missed', async () => {
    const { sockets, errors } = room()
    await settle()
    const socket = sockets[0]
    if (!socket) throw new Error('Expected a socket')
    socket.open()
    socket.receive({ type: 'welcome', peerId: 'me', peers: ['server'] })
    // A fragment that says more follows, then a whole frame in the middle of it.
    socket.receiveMessage(new Uint8Array([4, 1, 1, 0]))
    socket.receive({ type: 'join', peerId: 'alice' })
    expect(errors).toHaveLength(1)
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    await settle()
    expect(sockets).toHaveLength(2)
  })

  test('reconnects with a fresh ticket after losing the relay, saying its peers left', async () => {
    const { transport, sockets, left, tickets } = room()
    await settle()
    sockets[0]?.open()
    sockets[0]?.receive({ type: 'welcome', peerId: 'me', peers: ['server', 'alice'] })
    sockets[0]?.close(1006)
    expect(left).toEqual(['server', 'alice'])
    expect(transport.signalingConnected()).toBe(false)

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    await settle()
    expect(sockets).toHaveLength(2)
    sockets[1]?.open()
    expect(sockets[1]?.sent).toEqual([{ type: 'auth', token: 'ticket-2' }])
    expect(tickets()).toBe(2)
    await transport.leave()
  })

  test('stops when the relay refuses the ticket or the room', async () => {
    for (const code of [RELAY_CLOSE.unauthorized, RELAY_CLOSE.roomFull]) {
      const { sockets, errors } = room()
      await settle()
      sockets[0]?.open()
      sockets[0]?.close(code, 'refused')
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
      await settle()
      expect(sockets).toHaveLength(1)
      expect(errors).toEqual(['refused'])
    }
  })

  test('moves on, without reconnecting, once the relay says the document was restored', async () => {
    const { sockets, restored, errors } = room()
    await settle()
    sockets[0]?.open()
    sockets[0]?.close(RELAY_CLOSE.restored, 'The document was restored')
    await settle()
    expect(restored()).toBe(1)
    expect(sockets).toHaveLength(1)
    expect(errors).toEqual([])
  })

  test('moves on when a fresh ticket is for the document’s new room', async () => {
    const { sockets, restored } = room({ movedAt: 2 })
    await settle()
    sockets[0]?.open()
    sockets[0]?.close(1006, 'Connection lost')
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    await settle()
    expect(restored()).toBe(1)
    expect(sockets).toHaveLength(1)
  })

  test('moves on once when the relay and a refreshed ticket both say so', async () => {
    jest.useFakeTimers()
    try {
      const { sockets, restored } = room({ movedAt: 2 })
      await settle()
      sockets[0]?.open()
      // The refresh is waiting on its ticket as the relay closes the room.
      jest.advanceTimersByTime(240_000)
      sockets[0]?.close(RELAY_CLOSE.restored, 'The document was restored')
      await settle()
      expect(restored()).toBe(1)
    } finally {
      jest.useRealTimers()
    }
  })

  test('closes its socket when a refreshed ticket is for the document’s new room', async () => {
    jest.useFakeTimers()
    try {
      const { sockets, left, restored } = room({ movedAt: 2 })
      await settle()
      sockets[0]?.open()
      sockets[0]?.receive({ type: 'welcome', peerId: 'me', peers: ['server', 'alice'] })
      jest.advanceTimersByTime(240_000)
      await settle()
      expect(restored()).toBe(1)
      expect(sockets[0]?.readyState).toBe(WebSocket.CLOSED)
      expect(left).toEqual(['server', 'alice'])
    } finally {
      jest.useRealTimers()
    }
  })

  test('leaving closes the socket and never reconnects', async () => {
    const { transport, sockets } = room()
    await settle()
    sockets[0]?.open()
    await transport.leave()
    expect(sockets[0]?.readyState).toBe(WebSocket.CLOSED)
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(sockets).toHaveLength(1)
  })

  test('retries a failed ticket refresh while the current ticket still holds', async () => {
    jest.useFakeTimers()
    try {
      const { transport, sockets, errors } = room({ failTicket: (attempt) => attempt === 2 })
      await settle()
      sockets[0]?.open()
      // The first refresh comes a minute before the five-minute ticket expires, and fails.
      jest.advanceTimersByTime(240_000)
      await settle()
      expect(errors).toHaveLength(1)
      jest.advanceTimersByTime(5_000)
      await settle()
      const auths = sockets[0]?.sent.filter((frame) => frame.type === 'auth')
      expect(auths?.map((frame) => (frame.type === 'auth' ? frame.token : ''))).toEqual([
        'ticket-1',
        'ticket-3'
      ])
      await transport.leave()
    } finally {
      jest.useRealTimers()
    }
  })

  test('ignores frames from a socket it left', async () => {
    const { transport, sockets, joined } = room()
    await settle()
    const socket = sockets[0]
    await transport.leave()
    socket?.receive({ type: 'welcome', peerId: 'me', peers: ['server', 'ada'] })
    expect(joined).toEqual([])
  })
})
