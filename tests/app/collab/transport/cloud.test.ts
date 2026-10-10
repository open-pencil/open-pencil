import { describe, expect, test } from 'bun:test'

import {
  decodeRelayClientFrame,
  encodeRelayServerFrame,
  RELAY_CLOSE,
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

  send(data: Uint8Array) {
    const frame = decodeRelayClientFrame(data)
    if (frame) this.sent.push(frame)
  }

  open() {
    this.readyState = WebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  receive(frame: RelayServerFrame) {
    const data = encodeRelayServerFrame(frame)
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

function room() {
  const sockets: FakeSocket[] = []
  let tickets = 0
  const errors: unknown[] = []
  const join = createCloudRelayJoin({
    url: 'wss://cloud.example.com/api/collaboration/relay',
    ticket: async () => {
      tickets += 1
      return { token: `ticket-${tickets}`, expiresAt: new Date(Date.now() + 300_000).toISOString() }
    },
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return asDouble<WebSocket>(socket)
    },
    reconnectDelayMs: () => 0,
    onError: (_message, error) => errors.push(error)
  })
  const transport = join('cloud:room:0')
  const joined: string[] = []
  const left: string[] = []
  transport.onPeerJoin((peerId) => joined.push(peerId))
  transport.onPeerLeave((peerId) => left.push(peerId))
  return { transport, sockets, joined, left, errors, tickets: () => tickets }
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
})
