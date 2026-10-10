import type {
  CollabActionReceiver,
  CollabRoomTransport,
  JoinCollabRoom
} from '@/app/collab/transport'

interface LocalPeer {
  id: string
  receivers: Map<string, CollabActionReceiver[]>
  onJoin: ((peerId: string) => void)[]
  onLeave: ((peerId: string) => void)[]
}

/** Peers learn about each other on a later task, after the session has set up its handlers. */
function later(callback: () => void): void {
  setTimeout(callback, 0)
}

/**
 * A room whose peers all live on this page. It implements the same transport the app's
 * peer-to-peer rooms use, so two editors on the landing sync through the app's real room
 * sessions, with nothing leaving the page and no signalling service involved.
 */
export function createLocalRoom(): JoinCollabRoom {
  const peers = new Map<string, LocalPeer>()
  let nextId = 0

  return () => {
    const self: LocalPeer = {
      id: `local-${++nextId}`,
      receivers: new Map(),
      onJoin: [],
      onLeave: []
    }
    const others = () => [...peers.values()].filter((peer) => peer !== self)

    later(() => {
      for (const other of others()) {
        for (const handler of other.onJoin) handler(self.id)
        for (const handler of self.onJoin) handler(other.id)
      }
    })
    peers.set(self.id, self)

    const transport: CollabRoomTransport = {
      makeAction(namespace) {
        const send = (data: Uint8Array, peerId?: string) => {
          // A copy, as a network would deliver, so no peer shares the sender's buffer.
          const payload = data.slice()
          later(() => {
            for (const other of others()) {
              if (peerId && other.id !== peerId) continue
              for (const receive of other.receivers.get(namespace) ?? []) receive(payload, self.id)
            }
          })
        }
        const receive = (handler: CollabActionReceiver) => {
          self.receivers.set(namespace, [...(self.receivers.get(namespace) ?? []), handler])
        }
        return [send, receive]
      },
      onPeerJoin(handler) {
        self.onJoin.push(handler)
      },
      onPeerLeave(handler) {
        self.onLeave.push(handler)
      },
      signalingConnected: () => true,
      discoveryMs: 0,
      // Both screens are in one page, so there is no one to hear.
      media: null,
      async leave() {
        peers.delete(self.id)
        for (const other of others()) for (const handler of other.onLeave) handler(self.id)
      }
    }
    return transport
  }
}
