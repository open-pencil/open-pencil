import type { CollabAction, CollabActionReceiver, CollabRoomTransport } from './types'

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

function relayURL(roomId: string): URL {
  const configured = new URLSearchParams(window.location.search).get('collabRelay')
  if (!configured) throw new Error('Test collaboration transport requires collabRelay')
  const url = new URL(configured)
  url.searchParams.set('roomId', roomId)
  return url
}

export function joinTestCollabRoom(roomId: string): CollabRoomTransport {
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
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as TestTransportMessage
    if (message.senderId === peerId) return
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
        (handler) => receivers.set(namespace, handler)
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
      post({ type: 'leave', senderId: peerId })
      socket.close()
      peers.clear()
      receivers.clear()
    }
  }
}
