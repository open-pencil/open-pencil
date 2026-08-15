import { useTimeoutFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import { randomIndex } from '@open-pencil/core/random'

import { connectCollabRoom } from '@/app/collab/room'
import type { CollabRoomTransport } from '@/app/collab/transport'
import {
  collaborationTicketRefreshDelay,
  requireActiveCollaborationTicket,
  sameCollaborationRoom
} from '@/app/collab/ticket'
import type { CloudCollaborationCredentials, CollabState } from '@/app/collab/types'
import { bindCollabGraphEvents, registerYjsObservers } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { PEER_COLORS } from '@/constants'

export type CollabRuntime = {
  ydoc: Y.Doc | null
  awareness: awarenessProtocol.Awareness | null
  ynodes: Y.Map<Y.Map<unknown>> | null
  yimages: Y.Map<Uint8Array> | null
  room: CollabRoomTransport | null
  persistence: IndexeddbPersistence | null
  connectedStore: EditorStore | null
  suppressGraphSync: boolean
  suppressYjsEvents: boolean
  unbindGraphEvents: (() => void) | null
  stopZoomWatch: (() => void) | null
  stopTicketRefresh: (() => void) | null
}

type ConnectCollabSessionOptions = {
  roomId: string
  roomPassword?: string
  cloud?: CloudCollaborationCredentials
  onCloudTicketError: (error: unknown) => void
  runtime: CollabRuntime
  state: Ref<CollabState>
  store: EditorStore
  disconnect: () => void
  updatePeersList: () => void
  tickFollow: () => void
  broadcastAwareness: () => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
  syncNodeToYjs: (nodeId: string) => void
}

type CollabConnectionActionsOptions = {
  runtime: CollabRuntime
  state: Ref<CollabState>
  getStore: () => EditorStore
  updatePeersList: () => void
  tickFollow: () => void
  broadcastAwareness: () => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
  syncNodeToYjs: (nodeId: string) => void
  resetFollow: () => void
  getLocalName: () => string
  onCloudTicketError: (error: unknown) => void
}

type CollabSessionResources = {
  store: EditorStore
  room: CollabRoomTransport | null
  awareness: awarenessProtocol.Awareness | null
  persistence: IndexeddbPersistence | null
  ydoc: Y.Doc | null
  unbindGraphEvents: (() => void) | null
  stopZoomWatch: (() => void) | null
  stopTicketRefresh: (() => void) | null
  resetFollow: () => void
}

export function createCollabRuntime(): CollabRuntime {
  return {
    ydoc: null,
    awareness: null,
    ynodes: null,
    yimages: null,
    room: null,
    persistence: null,
    connectedStore: null,
    suppressGraphSync: false,
    suppressYjsEvents: false,
    unbindGraphEvents: null,
    stopZoomWatch: null,
    stopTicketRefresh: null
  }
}

export function createInitialCollabState(localName: string): CollabState {
  return {
    connected: false,
    roomId: null,
    peers: [],
    localName,
    localColor: PEER_COLORS[randomIndex(PEER_COLORS.length)],
    identity: {
      source: 'local',
      principal: null,
      permission: null,
      serverEnforcedWrites: false
    }
  }
}

export function createCollabConnectionActions({
  runtime,
  state,
  getStore,
  updatePeersList,
  tickFollow,
  broadcastAwareness,
  applyYjsToGraph,
  syncNodeToYjs,
  resetFollow,
  getLocalName,
  onCloudTicketError
}: CollabConnectionActionsOptions) {
  function connect(roomId: string) {
    connectCollabSession({
      roomId,
      onCloudTicketError,
      runtime,
      state,
      store: getStore(),
      disconnect,
      updatePeersList,
      tickFollow,
      broadcastAwareness,
      applyYjsToGraph,
      syncNodeToYjs
    })
  }

  function connectCloud(credentials: CloudCollaborationCredentials) {
    const ticket = requireActiveCollaborationTicket(credentials.ticket)
    connectCollabSession({
      roomId: ticket.roomId,
      roomPassword: ticket.roomKey,
      cloud: credentials,
      onCloudTicketError,
      runtime,
      state,
      store: getStore(),
      disconnect,
      updatePeersList,
      tickFollow,
      broadcastAwareness,
      applyYjsToGraph,
      syncNodeToYjs
    })
  }

  function disconnect() {
    const store = runtime.connectedStore ?? getStore()
    disposeCollabSessionResources({
      store,
      room: runtime.room,
      awareness: runtime.awareness,
      persistence: runtime.persistence,
      ydoc: runtime.ydoc,
      unbindGraphEvents: runtime.unbindGraphEvents,
      stopZoomWatch: runtime.stopZoomWatch,
      stopTicketRefresh: runtime.stopTicketRefresh,
      resetFollow
    })
    resetCollabRuntime(runtime)
    resetCollabConnectionState(state, getLocalName())
  }

  return { connect, connectCloud, disconnect }
}

export function watchAwarenessZoom(store: EditorStore, getAwareness: () => Awareness | null) {
  return store.onEditorEvent('viewport:changed', (viewport) => {
    const awareness = getAwareness()
    if (!awareness) return
    const prev = awareness.getLocalState()?.cursor as
      | { x: number; y: number; pageId: string; zoom: number }
      | undefined
    if (prev) {
      awareness.setLocalStateField('cursor', { ...prev, zoom: viewport.zoom })
    }
  })
}

export function connectCollabSession({
  roomId,
  roomPassword,
  cloud,
  onCloudTicketError,
  runtime,
  state,
  store,
  disconnect,
  updatePeersList,
  tickFollow,
  broadcastAwareness,
  applyYjsToGraph,
  syncNodeToYjs
}: ConnectCollabSessionOptions) {
  if (runtime.room) disconnect()

  runtime.connectedStore = store
  state.value.roomId = roomId
  if (cloud) {
    const ticket = requireActiveCollaborationTicket(cloud.ticket)
    state.value.localName = ticket.principal.name
    state.value.identity = {
      source: 'cloud',
      principal: ticket.principal,
      permission: ticket.permission,
      serverEnforcedWrites: ticket.serverEnforcedWrites
    }
    store.setAccessMode(ticket.permission)
  } else {
    state.value.identity = {
      source: 'local',
      principal: null,
      permission: null,
      serverEnforcedWrites: false
    }
  }
  runtime.ydoc = new Y.Doc()
  runtime.awareness = new awarenessProtocol.Awareness(runtime.ydoc)
  runtime.ynodes = runtime.ydoc.getMap('nodes')
  runtime.yimages = runtime.ydoc.getMap('images')
  runtime.persistence = new IndexeddbPersistence(`op-room-${roomId}`, runtime.ydoc)

  runtime.awareness.on('change', () => {
    updatePeersList()
    tickFollow()
  })

  registerYjsObservers({
    store,
    ynodes: runtime.ynodes,
    yimages: runtime.yimages,
    getSuppressYjsEvents: () => runtime.suppressYjsEvents,
    setSuppressGraphSync: (value) => {
      runtime.suppressGraphSync = value
    },
    applyYjsToGraph
  })

  const roomConnection = connectCollabRoom({
    roomId,
    roomPassword,
    canSendUpdates: store.canMutate,
    ydoc: runtime.ydoc,
    awareness: runtime.awareness,
    setConnected: () => {
      state.value.connected = true
    },
    updatePeersList
  })
  runtime.room = roomConnection.room
  state.value.connected = true
  broadcastAwareness()

  runtime.stopZoomWatch = watchAwarenessZoom(store, () => runtime.awareness)
  if (cloud) {
    scheduleCollaborationTicketRefresh({
      credentials: cloud,
      runtime,
      state,
      store,
      reconnect: (credentials) =>
        connectCollabSession({
          roomId: credentials.ticket.roomId,
          roomPassword: credentials.ticket.roomKey,
          cloud: credentials,
          onCloudTicketError,
          runtime,
          state,
          store,
          disconnect,
          updatePeersList,
          tickFollow,
          broadcastAwareness,
          applyYjsToGraph,
          syncNodeToYjs
        }),
      disconnect,
      broadcastAwareness,
      onError: onCloudTicketError
    })
  }

  runtime.unbindGraphEvents = store.canMutate()
    ? bindCollabGraphEvents({
        store,
        getYdoc: () => runtime.ydoc,
        getYnodes: () => runtime.ynodes,
        getSuppressGraphSync: () => runtime.suppressGraphSync,
        setSuppressYjsEvents: (value) => {
          runtime.suppressYjsEvents = value
        },
        syncNodeToYjs
      })
    : null
}

type CollaborationTicketRefreshOptions = {
  credentials: CloudCollaborationCredentials
  runtime: CollabRuntime
  state: Ref<CollabState>
  store: EditorStore
  reconnect: (credentials: CloudCollaborationCredentials) => void
  disconnect: () => void
  broadcastAwareness: () => void
  onError: (error: unknown) => void
}

export function scheduleCollaborationTicketRefresh({
  credentials,
  runtime,
  state,
  store,
  reconnect,
  disconnect,
  broadcastAwareness,
  onError
}: CollaborationTicketRefreshOptions): void {
  const current = requireActiveCollaborationTicket(credentials.ticket)
  const timer = useTimeoutFn(
    async () => {
      try {
        const refreshed = requireActiveCollaborationTicket(await credentials.refresh())
        const nextCredentials = { ...credentials, ticket: refreshed }
        if (!sameCollaborationRoom(current, refreshed)) {
          reconnect(nextCredentials)
          return
        }
        state.value.localName = refreshed.principal.name
        state.value.identity = {
          source: 'cloud',
          principal: refreshed.principal,
          permission: refreshed.permission,
          serverEnforcedWrites: refreshed.serverEnforcedWrites
        }
        store.setAccessMode(refreshed.permission)
        broadcastAwareness()
        scheduleCollaborationTicketRefresh({
          credentials: nextCredentials,
          runtime,
          state,
          store,
          reconnect,
          disconnect,
          broadcastAwareness,
          onError
        })
      } catch (error) {
        disconnect()
        onError(error)
      }
    },
    collaborationTicketRefreshDelay(current),
    { immediate: true }
  )
  runtime.stopTicketRefresh = timer.stop
}

export function resetCollabRuntime(runtime: CollabRuntime) {
  runtime.unbindGraphEvents = null
  runtime.stopZoomWatch = null
  runtime.stopTicketRefresh = null
  runtime.room = null
  runtime.awareness = null
  runtime.persistence = null
  runtime.ydoc = null
  runtime.ynodes = null
  runtime.yimages = null
  runtime.connectedStore = null
}

export function resetCollabConnectionState(state: Ref<CollabState>, localName: string) {
  state.value.connected = false
  state.value.roomId = null
  state.value.peers = []
  state.value.localName = localName
  state.value.identity = {
    source: 'local',
    principal: null,
    permission: null,
    serverEnforcedWrites: false
  }
}

export function disposeCollabSessionResources(resources: CollabSessionResources) {
  resources.unbindGraphEvents?.()
  resources.stopZoomWatch?.()
  resources.stopTicketRefresh?.()
  void resources.room?.leave()
  resources.awareness?.destroy()
  if (resources.persistence) {
    void resources.persistence.destroy()
  }
  resources.ydoc?.destroy()
  resources.resetFollow()
  resources.store.state.remoteCursors = []
  resources.store.requestRender()
}
