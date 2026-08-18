import * as decoding from 'lib0/decoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { joinCollabRoom, type JoinCollabRoom } from '@/app/collab/transport'

export type CollabRoomOptions = {
  roomId: string
  ydoc: Y.Doc
  awareness: awarenessProtocol.Awareness
  setConnected: () => void
  updatePeersList: () => void
  joinRoom?: JoinCollabRoom
}

export type CollabRoomConnection = {
  room: ReturnType<JoinCollabRoom>
  sendYjsUpdate: (data: Uint8Array, peerId?: string) => void
  sendAwareness: (data: Uint8Array, peerId?: string) => void
  sendSyncStep1: (data: Uint8Array, peerId?: string) => void
}

function awarenessClientIds(data: Uint8Array): number[] {
  try {
    const decoder = decoding.createDecoder(data)
    const count = decoding.readVarUint(decoder)
    const clients: number[] = []
    for (let index = 0; index < count; index++) {
      clients.push(decoding.readVarUint(decoder))
      decoding.readVarUint(decoder)
      decoding.readVarString(decoder)
    }
    return clients
  } catch {
    return []
  }
}

export function connectCollabRoom({
  roomId,
  ydoc,
  awareness,
  setConnected,
  updatePeersList,
  joinRoom = joinCollabRoom
}: CollabRoomOptions): CollabRoomConnection {
  const room = joinRoom(roomId)
  const [sendYjsUpdate, getUpdate] = room.makeAction('yjs-update')
  const [sendAwareness, getAwareness] = room.makeAction('awareness')
  const [sendSyncStep1, getSyncStep1] = room.makeAction('sync-step1')
  const [sendSyncReply, getSyncReply] = room.makeAction('sync-reply')

  const awarenessClientsByPeer = new Map<string, Set<number>>()

  getUpdate((data) => {
    Y.applyUpdate(ydoc, data, 'remote')
  })

  getAwareness((data, peerId) => {
    awarenessClientsByPeer.set(peerId, new Set(awarenessClientIds(data)))
    awarenessProtocol.applyAwarenessUpdate(awareness, data, 'remote')
  })

  getSyncStep1((stateVector, peerId) => {
    const update = Y.encodeStateAsUpdate(ydoc, stateVector)
    sendSyncReply(update, peerId)
  })

  getSyncReply((data) => {
    Y.applyUpdate(ydoc, data, 'remote')
  })

  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return
    sendYjsUpdate(update)
  })

  awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === 'remote' || origin === 'peer-left') return
      const changedClients = [...added, ...updated, ...removed]
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      sendAwareness(encodedUpdate)
    }
  )

  room.onPeerJoin((peerId) => {
    setConnected()
    sendSyncStep1(Y.encodeStateVector(ydoc), peerId)
    sendAwareness(awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]), peerId)
  })

  room.onPeerLeave((peerId) => {
    const remoteClients = [...(awarenessClientsByPeer.get(peerId) ?? [])]
    awarenessClientsByPeer.delete(peerId)
    awarenessProtocol.removeAwarenessStates(awareness, remoteClients, 'peer-left')
    updatePeersList()
  })

  return { room, sendYjsUpdate, sendAwareness, sendSyncStep1 }
}
