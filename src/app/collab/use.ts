import { tryOnScopeDispose, useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import { createFollowActions, generateRoomId } from '@/app/collab/awareness'
import { createLocalAwarenessActions } from '@/app/collab/local-awareness'
import {
  createCollabConnectionActions,
  createCollabRuntime,
  createInitialCollabState
} from '@/app/collab/session'
import type { CollabState } from '@/app/collab/types'
import { createYjsGraphSync } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'

export { COLLAB_KEY, useCollabInjected } from '@/app/collab/context'
export { DEFAULT_COLLAB_STATE } from '@/app/collab/types'
export type { CloudCollaborationCredentials, CollabState, RemotePeer } from '@/app/collab/types'

export function useCollab(storeOrGetter: EditorStore | (() => EditorStore)) {
  const getStore = () =>
    typeof storeOrGetter === 'function' ? (storeOrGetter as () => EditorStore)() : storeOrGetter
  const storedName = useLocalStorage('op-collab-name', '')
  const state = ref<CollabState>(createInitialCollabState(storedName.value))
  const runtime = createCollabRuntime()
  const remotePeers = computed(() => state.value.peers)
  const getActiveStore = () => runtime.connectedStore ?? getStore()

  const { followingPeer, followPeer, resetFollow, tickFollow } = createFollowActions(
    getActiveStore,
    () => runtime.awareness
  )
  const { broadcastAwareness, updateCursor, updateSelection, updatePeersList, setLocalName } =
    createLocalAwarenessActions({
      state,
      storedName,
      getStore: getActiveStore,
      getAwareness: () => runtime.awareness
    })

  const { syncNodeToYjs, syncAllNodesToYjs, applyYjsToGraph } = createYjsGraphSync({
    getStore: getActiveStore,
    getYdoc: () => runtime.ydoc,
    getYnodes: () => runtime.ynodes,
    getYimages: () => runtime.yimages,
    setSuppressYjsEvents: (value) => {
      runtime.suppressYjsEvents = value
    }
  })
  const { connect, connectCloud, disconnect } = createCollabConnectionActions({
    runtime,
    state,
    getStore,
    updatePeersList,
    tickFollow,
    broadcastAwareness,
    applyYjsToGraph,
    syncNodeToYjs,
    resetFollow,
    getLocalName: () => storedName.value,
    onCloudTicketError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Cloud collaboration disconnected: ${message}`)
    }
  })

  function connectWithAccess(roomId: string, accessMode: 'edit' | 'view') {
    getStore().setAccessMode(accessMode)
    connect(roomId)
  }

  function shareCurrentDoc(): string {
    const roomId = generateRoomId()
    connect(roomId)
    syncAllNodesToYjs()
    return roomId
  }

  tryOnScopeDispose(disconnect)

  return {
    state,
    remotePeers,
    followingPeer,
    connect,
    connectCloud,
    connectWithAccess,
    disconnect,
    shareCurrentDoc,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow
  }
}
