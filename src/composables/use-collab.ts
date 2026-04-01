import { useLocalStorage } from '@vueuse/core'
import { joinRoom as joinTrysteroRoom } from 'trystero/mqtt'
import { ref, watch, onUnmounted, computed, type InjectionKey, inject } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import {
  TRYSTERO_APP_ID,
  PEER_COLORS,
  ROOM_ID_LENGTH,
  ROOM_ID_CHARS,
  YJS_JSON_FIELDS
} from '@/constants'
import { randomIndex } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { Color, SceneNode } from '@open-pencil/core'
import type { Room } from 'trystero'

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
}

export interface CollabState {
  connected: boolean
  roomId: string | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
}

export const DEFAULT_COLLAB_STATE: CollabState = {
  connected: false,
  roomId: null,
  peers: [],
  localName: '',
  localColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 }
}

export function useCollab(storeOrGetter: EditorStore | (() => EditorStore)) {
  const getStore = () =>
    typeof storeOrGetter === 'function'
      ? (storeOrGetter as () => EditorStore)()
      : storeOrGetter
  const storedName = useLocalStorage('op-collab-name', '')
  const state = ref<CollabState>({
    connected: false,
    roomId: null,
    peers: [],
    localName: storedName.value,
    localColor: PEER_COLORS[randomIndex(PEER_COLORS.length)]
  })

  let ydoc: Y.Doc | null = null
  let awareness: awarenessProtocol.Awareness | null = null
  let ynodes: Y.Map<Y.Map<unknown>> | null = null
  let yimages: Y.Map<Uint8Array> | null = null
  let room: Room | null = null
  let persistence: IndexeddbPersistence | null = null
  let connectedStore: EditorStore | null = null
  let suppressGraphSync = false
  let suppressYjsEvents = false
  let unbindGraphEvents: (() => void) | null = null
  let stopZoomWatch: (() => void) | null = null
  let sendYjsUpdate: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendAwareness: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendSyncStep1: ((data: Uint8Array, peerId?: string) => void) | null = null

  const remotePeers = computed(() => state.value.peers)

  function connect(roomId: string) {
    if (room) disconnect()

    const store = getStore()
    connectedStore = store
    state.value.roomId = roomId
    ydoc = new Y.Doc()
    awareness = new awarenessProtocol.Awareness(ydoc)
    ynodes = ydoc.getMap('nodes')
    yimages = ydoc.getMap('images')

    persistence = new IndexeddbPersistence(`op-room-${roomId}`, ydoc)

    awareness.on('change', () => {
      updatePeersList()
      tickFollow()
    })

    ynodes.observeDeep((events) => {
      if (suppressYjsEvents) return
      suppressGraphSync = true
      try {
        applyYjsToGraph(events)
      } finally {
        suppressGraphSync = false
      }
      store.requestRender()
    })

    yimages.observe((event) => {
      if (suppressYjsEvents) return
      for (const [key, change] of event.changes.keys) {
        if (change.action === 'add' || change.action === 'update') {
          const data = yimages?.get(key)
          if (data) store.graph.images.set(key, new Uint8Array(data))
        } else {
          store.graph.images.delete(key)
        }
      }
      store.requestRender()
    })

    room = joinTrysteroRoom(
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

    sendYjsUpdate = (data, peerId) => void (peerId ? sendUpdate(data, peerId) : sendUpdate(data))
    sendAwareness = (data, peerId) => void (peerId ? sendAw(data, peerId) : sendAw(data))
    sendSyncStep1 = (data, peerId) => void (peerId ? sendSync(data, peerId) : sendSync(data))

    getUpdate((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    getAw((data) => {
      if (!awareness) return
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(data), null)
    })

    getSync((data, peerId) => {
      if (!ydoc) return
      const sv = new Uint8Array(data)
      const update = Y.encodeStateAsUpdate(ydoc, sv)
      void sendSyncReply(update, peerId)
    })

    getSyncReply((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      sendYjsUpdate?.(update)
    })

    const localAwareness = awareness
    const localYdoc = ydoc

    localAwareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = [...added, ...updated, ...removed]
        const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(
          localAwareness,
          changedClients
        )
        sendAwareness?.(encodedUpdate)
      }
    )

    room.onPeerJoin((peerId) => {
      state.value.connected = true
      const sv = Y.encodeStateVector(localYdoc)
      sendSyncStep1?.(sv, peerId)

      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(localAwareness, [
        localAwareness.clientID
      ])
      sendAwareness?.(encodedUpdate, peerId)
    })

    room.onPeerLeave(() => {
      const remoteClients = [...localAwareness.getStates().keys()].filter(
        (id) => id !== localAwareness.clientID
      )
      awarenessProtocol.removeAwarenessStates(localAwareness, remoteClients, 'peer-left')
      updatePeersList()
    })

    state.value.connected = true
    broadcastAwareness()

    stopZoomWatch = watch(
      () => store.state.zoom,
      (zoom) => {
        if (!awareness) return
        const prev = awareness.getLocalState()?.cursor as
          | { x: number; y: number; pageId: string; zoom: number }
          | undefined
        if (prev) {
          awareness.setLocalStateField('cursor', { ...prev, zoom })
        }
      }
    )

    function onGraphMutation(nodeId: string) {
      if (!suppressGraphSync && ydoc && ynodes) {
        syncNodeToYjs(nodeId)
      }
    }

    const unbindUpdated = store.graph.emitter.on('node:updated', (id) => onGraphMutation(id))
    const unbindCreated = store.graph.emitter.on('node:created', (node) => onGraphMutation(node.id))
    const unbindReparented = store.graph.emitter.on('node:reparented', (nodeId) =>
      onGraphMutation(nodeId)
    )
    const unbindReordered = store.graph.emitter.on('node:reordered', (nodeId) =>
      onGraphMutation(nodeId)
    )
    const unbindDeleted = store.graph.emitter.on('node:deleted', (id) => {
      if (!suppressGraphSync && ydoc && ynodes) {
        suppressYjsEvents = true
        const map = ynodes
        ydoc.transact(() => {
          map.delete(id)
        })
        suppressYjsEvents = false
      }
    })

    unbindGraphEvents = () => {
      unbindUpdated()
      unbindCreated()
      unbindReparented()
      unbindReordered()
      unbindDeleted()
    }
  }

  function disconnect() {
    const store = connectedStore ?? getStore()
    unbindGraphEvents?.()
    unbindGraphEvents = null
    stopZoomWatch?.()
    stopZoomWatch = null
    void room?.leave()
    room = null
    sendYjsUpdate = null
    sendAwareness = null
    sendSyncStep1 = null

    if (awareness) {
      awareness.destroy()
      awareness = null
    }
    if (persistence) {
      void persistence.destroy()
      persistence = null
    }
    if (ydoc) {
      ydoc.destroy()
      ydoc = null
    }
    ynodes = null
    yimages = null
    state.value.connected = false
    state.value.roomId = null
    state.value.peers = []
    followingPeer.value = null
    store.state.remoteCursors = []
    store.requestRender()
    connectedStore = null
  }

  function syncNodeToYjs(nodeId: string) {
    const store = connectedStore ?? getStore()
    if (!ydoc || !ynodes) return
    const node = store.graph.getNode(nodeId)
    if (!node) return

    const localYnodes = ynodes
    const localYimages = yimages
    suppressYjsEvents = true
    ydoc.transact(() => {
      let ynode = localYnodes.get(nodeId)
      if (!ynode) {
        ynode = new Y.Map()
        localYnodes.set(nodeId, ynode)
      }
      syncNodePropsToYMap(node, ynode)

      if (localYimages) {
        for (const fill of node.fills) {
          if (fill.imageHash && !localYimages.has(fill.imageHash)) {
            const data = store.graph.images.get(fill.imageHash)
            if (data) localYimages.set(fill.imageHash, data)
          }
        }
      }
    })
    suppressYjsEvents = false
  }

  function syncNodePropsToYMap(node: SceneNode, ynode: Y.Map<unknown>) {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null) {
        ynode.set(key, JSON.stringify(value))
      } else {
        ynode.set(key, value)
      }
    }
  }

  function syncAllNodesToYjs() {
    const store = connectedStore ?? getStore()
    if (!ydoc || !ynodes) return
    const localYnodes = ynodes
    const localYimages = yimages
    suppressYjsEvents = true
    ydoc.transact(() => {
      for (const node of store.graph.getAllNodes()) {
        let ynode = localYnodes.get(node.id)
        if (!ynode) {
          ynode = new Y.Map()
          localYnodes.set(node.id, ynode)
        }
        syncNodePropsToYMap(node, ynode)
      }
    })
    if (localYimages) {
      ydoc.transact(() => {
        for (const [hash, data] of store.graph.images) {
          if (!localYimages.has(hash)) {
            localYimages.set(hash, data)
          }
        }
      })
    }
    suppressYjsEvents = false
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    const store = connectedStore ?? getStore()
    if (!ynodes) return
    const localYnodes = ynodes
    for (const event of events) {
      if (event.target === localYnodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'add') {
            const ynode = localYnodes.get(key)
            if (ynode) applyYnodeToGraph(key, ynode)
          } else if (change.action === 'delete') {
            store.graph.deleteNode(key)
          }
        }
      } else if (event.target.parent === localYnodes) {
        const nodeId = findNodeIdForYMap(event.target)
        if (nodeId) {
          const ynode = localYnodes.get(nodeId)
          if (ynode) applyYnodeToGraph(nodeId, ynode)
        }
      }
    }
  }

  function findNodeIdForYMap(ymap: Y.Map<unknown>): string | null {
    if (!ynodes) return null
    for (const [key, value] of ynodes.entries()) {
      if (value === ymap) return key
    }
    return null
  }

  function applyYnodeToGraph(nodeId: string, ynode: Y.Map<unknown>) {
    const store = connectedStore ?? getStore()
    const existing = store.graph.getNode(nodeId)
    const props: Record<string, unknown> = {}

    for (const [key, value] of ynode.entries()) {
      if (YJS_JSON_FIELDS.has(key)) {
        try {
          props[key] = typeof value === 'string' ? JSON.parse(value) : value
        } catch {
          props[key] = value
        }
      } else {
        props[key] = value
      }
    }

    if (existing) {
      store.graph.updateNode(nodeId, props as Partial<SceneNode>)
    } else {
      const parentId = props.parentId as string
      if (parentId && store.graph.getNode(parentId)) {
        const type = props.type as SceneNode['type']
        const node = store.graph.createNode(type, parentId, props as Partial<SceneNode>)
        store.graph.nodes.delete(node.id)
        node.id = nodeId
        store.graph.nodes.set(nodeId, node)
      }
    }
  }

  function broadcastAwareness() {
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: state.value.localName,
      color: state.value.localColor
    })
  }

  function updateCursor(x: number, y: number, pageId: string) {
    const store = connectedStore ?? getStore()
    if (!awareness) return
    awareness.setLocalStateField('cursor', { x, y, pageId, zoom: store.state.zoom })
  }

  function updateSelection(ids: string[]) {
    if (!awareness) return
    awareness.setLocalStateField('selection', ids)
  }

  function updatePeersList() {
    const store = connectedStore ?? getStore()
    if (!awareness) return
    const states = awareness.getStates()
    const peers: RemotePeer[] = []
    const localClientId = awareness.clientID
    const currentPageId = store.state.currentPageId

    states.forEach((peerState, clientId) => {
      if (clientId === localClientId) return
      const user = peerState.user as { name?: string; color?: Color } | undefined
      if (!user) return
      peers.push({
        clientId,
        name: user.name || 'Anonymous',
        color: user.color || PEER_COLORS[clientId % PEER_COLORS.length],
        cursor: peerState.cursor as RemotePeer['cursor'],
        selection: peerState.selection as string[]
      })
    })

    state.value.peers = peers
    store.state.remoteCursors = peers
      .filter((p) => p.cursor && p.cursor.pageId === currentPageId)
      .map((p) => {
        const cursor = p.cursor as NonNullable<RemotePeer['cursor']>
        return {
          name: p.name,
          color: p.color,
          x: cursor.x,
          y: cursor.y,
          selection: p.selection
        }
      })
    store.requestRender()
  }

  function setLocalName(name: string) {
    state.value.localName = name
    storedName.value = name
    broadcastAwareness()
  }

  function generateRoomId(): string {
    let result = ''
    for (let i = 0; i < ROOM_ID_LENGTH; i++) {
      result += ROOM_ID_CHARS[randomIndex(ROOM_ID_CHARS.length)]
    }
    return result
  }

  function shareCurrentDoc(): string {
    const roomId = generateRoomId()
    connect(roomId)
    syncAllNodesToYjs()
    return roomId
  }

  function joinRoom(roomId: string) {
    connect(roomId)
  }

  const followingPeer = ref<number | null>(null)

  function followPeer(clientId: number | null) {
    followingPeer.value = clientId
  }

  function tickFollow() {
    const store = connectedStore ?? getStore()
    if (!followingPeer.value || !awareness) return
    const peerState = awareness.getStates().get(followingPeer.value)
    if (!peerState?.cursor) {
      followingPeer.value = null
      return
    }
    const cursor = peerState.cursor as { x: number; y: number; pageId: string; zoom?: number }
    if (cursor.pageId !== store.state.currentPageId) {
      void store.switchPage(cursor.pageId)
    }
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    if (cursor.zoom) store.state.zoom = cursor.zoom
    const cw = canvas.width / devicePixelRatio
    const ch = canvas.height / devicePixelRatio
    store.state.panX = cw / 2 - cursor.x * store.state.zoom
    store.state.panY = ch / 2 - cursor.y * store.state.zoom
    store.requestRender()
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    state,
    remotePeers,
    followingPeer,
    connect: joinRoom,
    disconnect,
    shareCurrentDoc,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow
  }
}

export type CollabReturn = ReturnType<typeof useCollab>
export const COLLAB_KEY = Symbol('collab') as InjectionKey<CollabReturn>
export function useCollabInjected() {
  return inject(COLLAB_KEY)
}
