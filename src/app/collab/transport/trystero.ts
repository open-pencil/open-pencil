import { getRelaySockets, joinRoom as joinTrysteroRoom } from 'trystero/mqtt'

import { COLLAB_APP_ID } from '@/constants'

import type { CollabAction, JoinCollabRoom } from './types'

/**
 * Trystero announces a peer to the room's brokers about every 5.3 seconds, so after two rounds
 * and a WebRTC handshake everyone already in the room has met a newcomer.
 */
const TRYSTERO_DISCOVERY_MS = 12_000

export const joinTrysteroCollabRoom: JoinCollabRoom = (roomId) => {
  const room = joinTrysteroRoom(
    {
      appId: COLLAB_APP_ID,
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    },
    roomId
  )

  return {
    makeAction(namespace): CollabAction {
      const [send, receive] = room.makeAction<Uint8Array>(namespace)
      return [
        (data, peerId) => void (peerId ? send(data, peerId) : send(data)),
        (handler) => receive((data, peerId) => handler(new Uint8Array(data), peerId))
      ]
    },
    onPeerJoin: (handler) => room.onPeerJoin(handler),
    onPeerLeave: (handler) => room.onPeerLeave(handler),
    // Brokers are shared by every room this window joins; any one of them carries announcements.
    signalingConnected: () =>
      Object.values(getRelaySockets()).some((socket) => socket.readyState === WebSocket.OPEN),
    discoveryMs: TRYSTERO_DISCOVERY_MS,
    leave: async () => {
      await room.leave()
    }
  }
}
