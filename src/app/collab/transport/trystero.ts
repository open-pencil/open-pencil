import { joinRoom as joinTrysteroRoom } from 'trystero/mqtt'

import { TRYSTERO_APP_ID } from '@/constants'

import type { CollabAction, JoinCollabRoom } from './types'

export const joinTrysteroCollabRoom: JoinCollabRoom = (roomId) => {
  const room = joinTrysteroRoom(
    {
      appId: TRYSTERO_APP_ID,
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
    leave: async () => {
      await room.leave()
    }
  }
}
