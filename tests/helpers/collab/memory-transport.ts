import type { CollabRoomTransport, JoinCollabRoom } from '@/app/collab/transport'
import type { CollabActionReceiver } from '@/app/collab/transport/types'

type MemoryPeer = {
  id: string
  receivers: Map<string, CollabActionReceiver>
  joinHandlers: ((peerId: string) => void)[]
  leaveHandlers: ((peerId: string) => void)[]
  trackHandler: ((track: MediaStreamTrack, peerId: string) => void) | null
}

/** A track one peer is sending another. */
export type MemorySend = { from: string; to: string; track: MediaStreamTrack }

/**
 * Rooms in memory, for tests: every peer that joins a room ID meets the others in it, and
 * messages and tracks arrive on a later microtask, as they would over a network. `sends` lists
 * the tracks peers are sending each other now.
 */
export function createMemoryRooms(): {
  join: JoinCollabRoom
  settle: () => Promise<void>
  sends: () => MemorySend[]
} {
  const rooms = new Map<string, Set<MemoryPeer>>()
  const active: MemorySend[] = []
  let nextPeer = 1

  const join: JoinCollabRoom = (roomId): CollabRoomTransport => {
    const room = rooms.get(roomId) ?? new Set<MemoryPeer>()
    rooms.set(roomId, room)
    const self: MemoryPeer = {
      id: `peer-${nextPeer++}`,
      receivers: new Map(),
      joinHandlers: [],
      leaveHandlers: [],
      trackHandler: null
    }
    const others = () => [...room].filter((peer) => peer !== self)
    const deliver = (track: MediaStreamTrack, peerId: string) => {
      const peer = others().find((candidate) => candidate.id === peerId)
      queueMicrotask(() => peer?.trackHandler?.(track, self.id))
    }
    const stopSends = (to: string, track?: MediaStreamTrack) => {
      for (let index = active.length - 1; index >= 0; index--) {
        const send = active[index]
        if (send?.from === self.id && send.to === to && (!track || send.track === track)) {
          active.splice(index, 1)
        }
      }
    }
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
      media: {
        addTrack(track, _stream, peerId) {
          active.push({ from: self.id, to: peerId, track })
          deliver(track, peerId)
        },
        removeTrack(track, peerId) {
          stopSends(peerId, track)
        },
        replaceTrack(previous, next, peerId) {
          stopSends(peerId, previous)
          active.push({ from: self.id, to: peerId, track: next })
          deliver(next, peerId)
        },
        onPeerTrack(handler) {
          self.trackHandler = handler
        },
        connection: () => undefined
      },
      async leave() {
        room.delete(self)
        for (let index = active.length - 1; index >= 0; index--) {
          const send = active[index]
          if (send?.from === self.id || send?.to === self.id) active.splice(index, 1)
        }
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

  return { join, settle, sends: () => [...active] }
}
