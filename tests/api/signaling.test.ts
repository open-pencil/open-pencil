import { afterEach, describe, expect, test } from 'bun:test'

import { startApiServer } from '../../packages/api/src/server.js'

const SECRET = 'test-secret'

type SignalingMessage = {
  type: string
  peerId?: string
  peers?: string[]
  payload?: Record<string, unknown>
}

const sockets = new Set<WebSocket>()
const servers: Array<{ stop: () => void }> = []

afterEach(() => {
  for (const socket of sockets) {
    socket.close()
  }
  sockets.clear()

  for (const server of servers.splice(0)) {
    server.stop()
  }
})

type TestSocket = {
  socket: WebSocket
  nextMessage: () => Promise<SignalingMessage>
}

function connect(url: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const queue: SignalingMessage[] = []
    const waiters: Array<(message: SignalingMessage) => void> = []
    sockets.add(socket)
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as SignalingMessage
      const waiter = waiters.shift()
      if (waiter) waiter(message)
      else queue.push(message)
    })
    socket.addEventListener(
      'open',
      () =>
        resolve({
          socket,
          nextMessage: () =>
            new Promise((nextResolve) => {
              const queued = queue.shift()
              if (queued) {
                nextResolve(queued)
                return
              }
              waiters.push(nextResolve)
            })
        }),
      { once: true }
    )
    socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {
      once: true
    })
  })
}

describe('signaling websocket', () => {
  test('forwards offer, answer, and ice candidate messages within the same room', async () => {
    const { server } = startApiServer({ secret: SECRET, host: '127.0.0.1', port: 0 })
    servers.push(server)

    const url = `ws://127.0.0.1:${server.port}/api/ws/signaling?room=board-123`
    const first = await connect(url)
    const welcomeFirst = await first.nextMessage()

    expect(welcomeFirst).toMatchObject({
      type: 'welcome',
      peers: []
    })
    expect(welcomeFirst.peerId).toBeString()

    const second = await connect(url)
    const [joinedFirst, welcomeSecond] = await Promise.all([
      first.nextMessage(),
      second.nextMessage()
    ])

    expect(joinedFirst).toMatchObject({
      type: 'peer-joined',
      peerId: welcomeSecond.peerId
    })
    expect(welcomeSecond).toMatchObject({
      type: 'welcome',
      peers: [welcomeFirst.peerId]
    })
    expect(welcomeSecond.peerId).toBeString()

    first.socket.send(
      JSON.stringify({
        type: 'offer',
        targetPeerId: welcomeSecond.peerId,
        payload: { type: 'offer', sdp: 'offer-sdp' }
      })
    )
    expect(await second.nextMessage()).toEqual({
      type: 'offer',
      peerId: welcomeFirst.peerId,
      payload: { type: 'offer', sdp: 'offer-sdp' }
    })

    second.socket.send(
      JSON.stringify({
        type: 'answer',
        targetPeerId: welcomeFirst.peerId,
        payload: { type: 'answer', sdp: 'answer-sdp' }
      })
    )
    expect(await first.nextMessage()).toEqual({
      type: 'answer',
      peerId: welcomeSecond.peerId,
      payload: { type: 'answer', sdp: 'answer-sdp' }
    })

    first.socket.send(
      JSON.stringify({
        type: 'ice-candidate',
        targetPeerId: welcomeSecond.peerId,
        payload: {
          candidate: 'candidate:1 1 UDP 2122252543 127.0.0.1 5000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        }
      })
    )
    expect(await second.nextMessage()).toEqual({
      type: 'ice-candidate',
      peerId: welcomeFirst.peerId,
      payload: {
        candidate: 'candidate:1 1 UDP 2122252543 127.0.0.1 5000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }
    })
  })
})
