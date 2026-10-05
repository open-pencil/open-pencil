import { computed } from 'vue'

import { useCollabIdentity } from '@/app/collab/identity'
import {
  activeRoom,
  activeTabLeftRoom,
  dismissLeftRoomNote,
  joinRoom,
  leaveRoom,
  shareDocument,
  type JoinRoomOptions
} from '@/app/collab/rooms'
import { DEFAULT_COLLAB_STATE, type CollabState, type RemotePeer } from '@/app/collab/types'
import { follow, presenceOf } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'
import { activeTab } from '@/app/tabs'

export { COLLAB_KEY, useCollabInjected } from '@/app/collab/context'
export { DEFAULT_COLLAB_STATE }
export type { CollabState, RemotePeer }

/**
 * The collaboration UI's view of the active tab: its room, if it is in one, and the app-wide
 * identity. Each room tab keeps its own session in `src/app/collab/rooms.ts`; switching tabs
 * switches what this shows.
 */
export function useCollab() {
  const identity = useCollabIdentity()

  const state = computed<CollabState>(() => {
    const room = activeRoom.value
    return {
      inRoom: room !== undefined,
      roomId: room?.roomId ?? null,
      status: room?.status.value ?? null,
      peers: room?.peers.value ?? [],
      localName: identity.name.value,
      localColor: identity.color,
      hasChosenName: identity.hasChosenName.value
    }
  })
  const remotePeers = computed(() => state.value.peers)
  const leftRoom = computed(() => activeTabLeftRoom.value)
  const following = computed(() => {
    const store = activeTab.value?.store
    return store ? presenceOf(store).following.value : null
  })
  const followingPeer = computed(() =>
    following.value?.kind === 'person' ? following.value.clientId : null
  )

  function followTarget(target: FollowTarget | null) {
    const store = activeTab.value?.store
    if (store) follow(store, target)
  }

  return {
    state,
    remotePeers,
    leftRoom,
    following,
    followingPeer,
    /** Opens a room in its own tab; false when the ID is not a room ID. */
    join: (roomId: string, options: JoinRoomOptions) => joinRoom(roomId, options) !== null,
    /** Puts the active tab's document into a room and returns the room ID. */
    shareCurrentDoc: (roomId?: string): string | null => {
      const store = activeTab.value?.store
      if (!store || activeTab.value?.kind === 'home') return null
      return shareDocument(store, roomId).roomId
    },
    disconnect: () => {
      const room = activeRoom.value
      if (room) leaveRoom(room)
    },
    updateCursor: (x: number, y: number, pageId: string) => {
      activeRoom.value?.updateCursor(x, y, pageId)
    },
    updateSelection: (ids: string[]) => {
      activeRoom.value?.updateSelection(ids)
    },
    dismissLeftRoomNote: () => {
      const store = activeTab.value?.store
      if (store) dismissLeftRoomNote(store)
    },
    setLocalName: identity.setName,
    follow: followTarget,
    followPeer: (clientId: number | null) =>
      followTarget(clientId === null ? null : { kind: 'person', clientId })
  }
}
