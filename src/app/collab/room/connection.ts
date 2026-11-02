import * as decoding from 'lib0/decoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import {
  COLLAB_ACTIONS,
  encodeSyncReply,
  decodeRoomUpdate,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_SERVER_PEER
} from '@open-pencil/cloud/contract'

import { joinCollabRoom, type JoinCollabRoom } from '@/app/collab/transport'
import type { CollabAction } from '@/app/collab/transport/types'

export type CollabRoomOptions = {
  roomId: string
  ydoc: Y.Doc
  awareness: awarenessProtocol.Awareness
  updatePeersList: () => void
  joinRoom?: JoinCollabRoom
  /** The most a peer's update may decode to; `MAX_COLLAB_MESSAGE_BYTES` unless a test lowers it. */
  maxMessageBytes?: number
}

export type CollabRoomConnection = {
  room: ReturnType<JoinCollabRoom>
  sendYjsUpdate: (data: Uint8Array, peerId?: string) => void
  sendAwareness: (data: Uint8Array, peerId?: string) => void
  sendSyncStep1: (data: Uint8Array, peerId?: string) => void
  /** What agents preview while they stream, apart from presence (`app/collab/agent-preview.ts`). */
  agentPreview: CollabAction
  /** Asking whoever saves the room's document to upload it now (`app/cloud/rooms/upload.ts`). */
  upload: CollabAction
  /** Follow peers leaving the room; returns the unsubscribe. */
  onPeerLeave: (handler: (peerId: string) => void) => () => void
  /** The peer whose awareness carries a presence client, so media reaches the right person. */
  peerForClient: (clientId: number) => string | undefined
  /** Follow peers answering this tab's state with theirs; returns the unsubscribe. */
  onSynced: (handler: (peerId: string) => void) => () => void
  /** Follow the server saying the document's version history changed; returns the unsubscribe. */
  onVersionsChanged: (handler: () => void) => () => void
}

type AwarenessEntry = { clientId: number; removed: boolean }

/**
 * Applies what a peer sent, inflated first when `compressed`, as a sync reply is. An update past
 * `limit` is dropped with a warning; data that does not inflate or decode came from a build that
 * does not share this room's format, or from a broken peer, and is dropped rather than thrown
 * from the transport's handler. Returns whether it applied.
 */
function applyRemote(
  ydoc: Y.Doc,
  data: Uint8Array,
  { limit, peerId, compressed = false }: { limit: number; peerId: string; compressed?: boolean }
): boolean {
  try {
    const update = decodeRoomUpdate(data, { limit, compressed })
    if (!update) {
      console.warn(`[Collab] Dropped an update from peer ${peerId} past ${limit} bytes`)
      return false
    }
    Y.applyUpdateV2(ydoc, update, 'remote')
    return true
  } catch {
    return false
  }
}

function awarenessEntries(data: Uint8Array): AwarenessEntry[] {
  try {
    const decoder = decoding.createDecoder(data)
    const count = decoding.readVarUint(decoder)
    const entries: AwarenessEntry[] = []
    for (let index = 0; index < count; index++) {
      const clientId = decoding.readVarUint(decoder)
      decoding.readVarUint(decoder)
      entries.push({ clientId, removed: decoding.readVarString(decoder) === 'null' })
    }
    return entries
  } catch {
    return []
  }
}

export function connectCollabRoom({
  roomId,
  ydoc,
  awareness,
  updatePeersList,
  joinRoom = joinCollabRoom,
  maxMessageBytes = MAX_COLLAB_MESSAGE_BYTES
}: CollabRoomOptions): CollabRoomConnection {
  const room = joinRoom(roomId)
  const [sendYjsUpdate, getUpdate] = room.makeAction(COLLAB_ACTIONS.yjsUpdate)
  const [sendAwareness, getAwareness] = room.makeAction(COLLAB_ACTIONS.awareness)
  const [sendSyncStep1, getSyncStep1] = room.makeAction(COLLAB_ACTIONS.syncStep1)
  const [sendSyncReply, getSyncReply] = room.makeAction(COLLAB_ACTIONS.syncReply)
  const agentPreview = room.makeAction(COLLAB_ACTIONS.agentPreview)
  const upload = room.makeAction(COLLAB_ACTIONS.upload)
  const [, getVersions] = room.makeAction(COLLAB_ACTIONS.versions)
  // A transport keeps one leave handler, so the connection shares it with its users.
  const leaveHandlers = new Set<(peerId: string) => void>()
  const syncedHandlers = new Set<(peerId: string) => void>()
  const versionsHandlers = new Set<() => void>()

  const awarenessClientsByPeer = new Map<string, Set<number>>()

  getUpdate((data, peerId) => {
    applyRemote(ydoc, data, { limit: maxMessageBytes, peerId })
  })

  getAwareness((data, peerId) => {
    // A peer also relays removals of clients it timed out, which are not its own.
    const clients = awarenessClientsByPeer.get(peerId) ?? new Set<number>()
    for (const { clientId, removed } of awarenessEntries(data)) {
      if (removed) clients.delete(clientId)
      else clients.add(clientId)
    }
    awarenessClientsByPeer.set(peerId, clients)
    awarenessProtocol.applyAwarenessUpdate(awareness, data, 'remote')
  })

  getVersions((_data, peerId) => {
    if (peerId !== RELAY_SERVER_PEER) return
    for (const handler of versionsHandlers) handler()
  })

  getSyncStep1((stateVector, peerId) => {
    sendSyncReply(encodeSyncReply(ydoc, stateVector), peerId)
  })

  getSyncReply((data, peerId) => {
    if (!applyRemote(ydoc, data, { limit: maxMessageBytes, peerId, compressed: true })) return
    for (const handler of syncedHandlers) handler(peerId)
  })

  ydoc.on('updateV2', (update: Uint8Array, origin: unknown) => {
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
    sendSyncStep1(Y.encodeStateVector(ydoc), peerId)
    sendAwareness(awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]), peerId)
  })

  room.onPeerLeave((peerId) => {
    const remoteClients = [...(awarenessClientsByPeer.get(peerId) ?? [])]
    awarenessClientsByPeer.delete(peerId)
    awarenessProtocol.removeAwarenessStates(awareness, remoteClients, 'peer-left')
    updatePeersList()
    for (const handler of leaveHandlers) handler(peerId)
  })

  return {
    room,
    sendYjsUpdate,
    sendAwareness,
    sendSyncStep1,
    agentPreview,
    upload,
    onPeerLeave(handler) {
      leaveHandlers.add(handler)
      return () => leaveHandlers.delete(handler)
    },
    onSynced(handler) {
      syncedHandlers.add(handler)
      return () => syncedHandlers.delete(handler)
    },
    onVersionsChanged(handler) {
      versionsHandlers.add(handler)
      return () => versionsHandlers.delete(handler)
    },
    peerForClient(clientId) {
      for (const [peerId, clients] of awarenessClientsByPeer) {
        if (clients.has(clientId)) return peerId
      }
      return undefined
    }
  }
}
