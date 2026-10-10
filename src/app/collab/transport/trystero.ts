import { getRelaySockets, joinRoom as joinTrysteroRoom, type Room } from '@trystero-p2p/mqtt'

import { COLLAB_APP_ID } from '@/constants'

import type { CollabAction, CollabMediaTransport, JoinCollabRoom } from './types'

/**
 * Trystero announces a newcomer to the room's brokers four times in its first 7.5 seconds, so
 * after those and a WebRTC handshake everyone already in the room has met it.
 */
const TRYSTERO_DISCOVERY_MS = 12_000

function trysteroMedia(room: Room): CollabMediaTransport {
  return {
    addTrack(track, stream, peerId) {
      void Promise.allSettled(room.addTrack(track, stream, { target: peerId }))
    },
    removeTrack(track, peerId) {
      room.removeTrack(track, { target: peerId })
    },
    replaceTrack(previous, next, peerId) {
      void Promise.allSettled(room.replaceTrack(previous, next, { target: peerId }))
    },
    onPeerTrack(handler) {
      room.onPeerTrack = (track, _stream, peerId) => handler(track, peerId)
    },
    connection: (peerId) => room.getPeers()[peerId]
  }
}

/**
 * Whether any relay socket Trystero shares between this window's rooms is open. Its types leave
 * the sockets untyped, and MQTT's may wrap a WebSocket rather than be one.
 */
function relayOpen(): boolean {
  const sockets: unknown = getRelaySockets()
  if (!sockets || typeof sockets !== 'object') return false
  return Object.values(sockets).some(
    (socket: unknown) =>
      typeof socket === 'object' &&
      socket !== null &&
      'readyState' in socket &&
      socket.readyState === WebSocket.OPEN
  )
}

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
      const action = room.makeAction<Uint8Array>(namespace)
      return [
        (data, peerId) => void action.send(data, peerId ? { target: peerId } : {}),
        (handler) => {
          action.onMessage = (data, { peerId }) => handler(new Uint8Array(data), peerId)
        }
      ]
    },
    onPeerJoin(handler) {
      room.onPeerJoin = handler
    },
    onPeerLeave(handler) {
      room.onPeerLeave = handler
    },
    // Brokers are shared by every room this window joins; any one of them carries announcements.
    signalingConnected: relayOpen,
    discoveryMs: TRYSTERO_DISCOVERY_MS,
    media: trysteroMedia(room),
    leave: async () => {
      await room.leave()
    }
  }
}
