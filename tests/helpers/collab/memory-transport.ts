import type { CollabRoomTransport, JoinCollabRoom } from '@/app/collab/transport'
import type { CollabActionReceiver } from '@/app/collab/transport/types'

type MemoryPeer = {
  id: string
  receivers: Map<string, CollabActionReceiver>
  joinHandlers: ((peerId: string) => void)[]
  leaveHandlers: ((peerId: string) => void)[]
}

/**
 * Rooms in memory, for tests: every peer that joins a room ID meets the others in it, and
 * messages arrive on a later microtask, as they would over a network.
 */
export function createMemoryRooms(): { join: JoinCollabRoom; settle: () => Promise<void> } {
  const rooms = new Map<string, Set<MemoryPeer>>()
  let nextPeer = 1

  const join: JoinCollabRoom = (roomId): CollabRoomTransport => {
    const room = rooms.get(roomId) ?? new Set<MemoryPeer>()
    rooms.set(roomId, room)
    const self: MemoryPeer = {
      id: `peer-${nextPeer++}`,
      receivers: new Map(),
      joinHandlers: [],
      leaveHandlers: []
    }
    const others = () => [...room].filter((peer) => peer !== self)
    // Peers meet once both sides have registered their handlers, as after a real handshake.
    queueMicrotask(() => {
      room.add(self)
      for (const peer of others()) {
        for (const handler of peer.joinHandlers) handler(self.id)
        for (const handler of self.joinHandlers) handler(peer.id)
      }
    })
    return {
      makeAction(namespace) {
        return [
          (data, peerId) => {
            for (const peer of others()) {
              if (peerId && peer.id !== peerId) continue
              const copy = data.slice()
              queueMicrotask(() => peer.receivers.get(namespace)?.(copy, self.id))
            }
          },
          (handler) => {
            self.receivers.set(namespace, handler)
          }
        ]
      },
      onPeerJoin(handler) {
        self.joinHandlers.push(handler)
      },
      onPeerLeave(handler) {
        self.leaveHandlers.push(handler)
      },
      signalingConnected: () => true,
      discoveryMs: 0,
      async leave() {
        room.delete(self)
        for (const peer of room) for (const handler of peer.leaveHandlers) handler(self.id)
      }
    }
  }

  /** Lets queued messages and the replies they trigger arrive. */
  async function settle() {
    for (let round = 0; round < 20; round++) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    }
  }

  return { join, settle }
}
