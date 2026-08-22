import { appRuntimeConfig } from '@/app/runtime/config'
import { IS_BROWSER } from '@/constants'

import type { CollabAction, CollabActionReceiver, CollabRoomTransport } from './types'

const MAX_TEST_MESSAGE_BYTES = 8 * 1024 * 1024

type TestTransportMessage =
  | { type: 'hello'; senderId: string; targetId?: string }
  | { type: 'welcome'; senderId: string; targetId?: string }
  | { type: 'leave'; senderId: string; targetId?: string }
  | {
      type: 'action'
      senderId: string
      targetId?: string
      namespace: string
      data: number[]
    }

function parseMessage(value: unknown): TestTransportMessage | null {
  if (typeof value !== 'string' || value.length > MAX_TEST_MESSAGE_BYTES) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed) || !('senderId' in parsed)) {
    return null
  }
  const message = parsed as Partial<TestTransportMessage>
  if (typeof message.senderId !== 'string') return null
  if (message.targetId !== undefined && typeof message.targetId !== 'string') return null
  if (message.type === 'hello' || message.type === 'welcome' || message.type === 'leave') {
    return message as TestTransportMessage
  }
  if (
    message.type !== 'action' ||
    typeof message.namespace !== 'string' ||
    !Array.isArray(message.data) ||
    !message.data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return null
  }
  return message as TestTransportMessage
}

function relayURL(roomId: string): URL {
  if (!IS_BROWSER) {
    throw new Error('Test collaboration transport requires a browser')
  }
  const configured = appRuntimeConfig.collaborationRelayURL
  if (!configured) throw new Error('Test collaboration transport requires collabRelay')
  const url = new URL(configured)
  url.searchParams.set('roomId', roomId)
  return url
}

export function joinTestCollabRoom(roomId: string): CollabRoomTransport {
  if (
    !IS_BROWSER ||
    typeof WebSocket === 'undefined' ||
    typeof crypto === 'undefined' ||
    typeof crypto.randomUUID !== 'function'
  ) {
    throw new Error('Test collaboration transport requires browser WebSocket and crypto APIs')
  }
  const peerId = crypto.randomUUID()
  const socket = new WebSocket(relayURL(roomId))
  const peers = new Set<string>()
  const receivers = new Map<string, CollabActionReceiver>()
  const pending: TestTransportMessage[] = []
  let joinHandler: ((peerId: string) => void) | null = null
  let leaveHandler: ((peerId: string) => void) | null = null
  let left = false

  function post(message: TestTransportMessage) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    else pending.push(message)
  }

  function addPeer(id: string) {
    if (id === peerId || peers.has(id)) return
    peers.add(id)
    joinHandler?.(id)
  }

  socket.addEventListener('open', () => {
    for (const message of pending.splice(0)) socket.send(JSON.stringify(message))
    post({ type: 'hello', senderId: peerId })
  })
  socket.addEventListener('error', () => {
    console.error('Test collaboration relay connection failed', socket.url)
  })
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = parseMessage(event.data)
    if (!message || message.senderId === peerId) return
    if (message.targetId && message.targetId !== peerId) return
    if (message.type === 'hello') {
      addPeer(message.senderId)
      post({ type: 'welcome', senderId: peerId, targetId: message.senderId })
      return
    }
    if (message.type === 'welcome') {
      addPeer(message.senderId)
      return
    }
    if (message.type === 'leave') {
      if (peers.delete(message.senderId)) leaveHandler?.(message.senderId)
    } else {
      addPeer(message.senderId)
      receivers.get(message.namespace)?.(new Uint8Array(message.data), message.senderId)
    }
  })

  return {
    makeAction(namespace): CollabAction {
      return [
        (data, targetId) => {
          post({
            type: 'action',
            senderId: peerId,
            targetId,
            namespace,
            data: Array.from(data)
          })
        },
        (handler) => {
          if (receivers.has(namespace)) {
            throw new Error(`Collaboration action ${namespace} is already registered`)
          }
          receivers.set(namespace, handler)
        }
      ]
    },
    onPeerJoin(handler) {
      joinHandler = handler
      for (const id of peers) queueMicrotask(() => handler(id))
    },
    onPeerLeave(handler) {
      leaveHandler = handler
    },
    async leave() {
      if (left) return
      left = true
      peers.clear()
      receivers.clear()
      const leaveMessage = JSON.stringify({ type: 'leave', senderId: peerId })
      if (socket.readyState === WebSocket.CONNECTING) {
        await new Promise<void>((resolve) => {
          socket.addEventListener('open', () => resolve(), { once: true })
          socket.addEventListener('error', () => resolve(), { once: true })
          socket.addEventListener('close', () => resolve(), { once: true })
        })
      }
      if (socket.readyState === WebSocket.OPEN) socket.send(leaveMessage)
      socket.close()
    }
  }
}
