import { joinRoom as joinTrysteroRoom } from 'trystero/mqtt'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { TRYSTERO_APP_ID } from '@/constants'

import type { Room } from 'trystero'

type CollabRoomOptions = {
  roomId: string
  ydoc: Y.Doc
  awareness: awarenessProtocol.Awareness
  setConnected: () => void
  updatePeersList: () => void
}

export type CollabRoomConnection = {
  room: Room
  sendYjsUpdate: (data: Uint8Array, peerId?: string) => void
  sendAwareness: (data: Uint8Array, peerId?: string) => void
  sendSyncStep1: (data: Uint8Array, peerId?: string) => void
}

export function connectCollabRoom({
  roomId,
  ydoc,
  awareness,
  setConnected,
  updatePeersList
}: CollabRoomOptions): CollabRoomConnection {
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

  const [sendUpdate, getUpdate] = room.makeAction<Uint8Array>('yjs-update')
  const [sendAw, getAw] = room.makeAction<Uint8Array>('awareness')
  const [sendSync, getSync] = room.makeAction<Uint8Array>('sync-step1')
  const [sendSyncReply, getSyncReply] = room.makeAction<Uint8Array>('sync-reply')

  const sendYjsUpdate = (data: Uint8Array, peerId?: string) =>
    void (peerId ? sendUpdate(data, peerId) : sendUpdate(data))
  const sendAwareness = (data: Uint8Array, peerId?: string) =>
    void (peerId ? sendAw(data, peerId) : sendAw(data))
  const sendSyncStep1 = (data: Uint8Array, peerId?: string) =>
    void (peerId ? sendSync(data, peerId) : sendSync(data))

  getUpdate((data) => {
    Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
  })

  getAw((data) => {
    awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(data), null)
  })

  getSync((data, peerId) => {
    const sv = new Uint8Array(data)
    const update = Y.encodeStateAsUpdate(ydoc, sv)
    void sendSyncReply(update, peerId)
  })

  getSyncReply((data) => {
    Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
  })

  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return
    sendYjsUpdate(update)
  })

  awareness.on(
    'update',
    ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = [...added, ...updated, ...removed]
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      sendAwareness(encodedUpdate)
    }
  )

  room.onPeerJoin((peerId) => {
    setConnected()
    const sv = Y.encodeStateVector(ydoc)
    sendSyncStep1(sv, peerId)

    const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
    sendAwareness(encodedUpdate, peerId)
  })

  room.onPeerLeave(() => {
    const remoteClients = [...awareness.getStates().keys()].filter(
      (id) => id !== awareness.clientID
    )
    awarenessProtocol.removeAwarenessStates(awareness, remoteClients, 'peer-left')
    updatePeersList()
  })

  return { room, sendYjsUpdate, sendAwareness, sendSyncStep1 }
}
