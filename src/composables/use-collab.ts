import { joinRoom as joinTrysteroRoom } from 'trystero/mqtt'
import { ref, shallowRef, watch, onUnmounted, computed, type InjectionKey, inject } from 'vue'
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

import type { SceneNode } from '@open-pencil/core'
import type { EditorStore } from '@/stores/editor'
import type { Color, VoiceState } from '@/types'
import type { Room } from 'trystero'

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
  voice?: VoiceState
}

export interface CollabState {
  connected: boolean
  roomId: string | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
}

export function useCollab(store: EditorStore) {
  const state = ref<CollabState>({
    connected: false,
    roomId: null,
    peers: [],
    localName: localStorage.getItem('op-collab-name') || '',
    localColor: PEER_COLORS[crypto.getRandomValues(new Uint8Array(1))[0] % PEER_COLORS.length]
  })

  let ydoc: Y.Doc | null = null
  let ynodes: Y.Map<Y.Map<unknown>> | null = null
  let persistence: IndexeddbPersistence | null = null
  const roomRef = shallowRef<Room | null>(null)
  const awarenessRef = shallowRef<awarenessProtocol.Awareness | null>(null)
  let suppressGraphEvents = false
  let suppressYjsEvents = false
  let sendYjsUpdate: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendAwareness: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendSyncStep1: ((data: Uint8Array, peerId?: string) => void) | null = null
  let onDisconnectVoice: (() => void) | null = null
  const peerJoinCallbacks: Array<(peerId: string) => void> = []
  const peerLeaveCallbacks: Array<(peerId: string) => void> = []

  const remotePeers = computed(() => state.value.peers)

  function connect(roomId: string) {
    if (roomRef.value) disconnect()

    state.value.roomId = roomId
    ydoc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(ydoc)
    awarenessRef.value = awareness
    ynodes = ydoc.getMap('nodes')

    persistence = new IndexeddbPersistence(`op-room-${roomId}`, ydoc)

    awareness.on('change', () => {
      updatePeersList()
      tickFollow()
    })

    ynodes.observeDeep((events) => {
      if (suppressYjsEvents) return
      suppressGraphEvents = true
      try {
        applyYjsToGraph(events)
      } finally {
        suppressGraphEvents = false
      }
      store.requestRender()
    })

    const room = joinTrysteroRoom(
      {
        appId: TRYSTERO_APP_ID,
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
              urls: 'turn:168.222.252.107:3478',
              username: 'openpencil',
              credential: '149a911b6db258cb6838daa565bb0d5d'
            },
            {
              urls: 'turn:168.222.252.107:3478?transport=tcp',
              username: 'openpencil',
              credential: '149a911b6db258cb6838daa565bb0d5d'
            }
          ]
        }
      },
      roomId
    )
    roomRef.value = room

    const [sendUpdate, getUpdate] = room.makeAction<Uint8Array>('yjs-update')
    const [sendAw, getAw] = room.makeAction<Uint8Array>('awareness')
    const [sendSync, getSync] = room.makeAction<Uint8Array>('sync-step1')
    const [sendSyncReply, getSyncReply] = room.makeAction<Uint8Array>('sync-reply')

    sendYjsUpdate = (data, peerId) => (peerId ? sendUpdate(data, peerId) : sendUpdate(data))
    sendAwareness = (data, peerId) => (peerId ? sendAw(data, peerId) : sendAw(data))
    sendSyncStep1 = (data, peerId) => (peerId ? sendSync(data, peerId) : sendSync(data))

    getUpdate((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    getAw((data) => {
      if (!awarenessRef.value) return
      awarenessProtocol.applyAwarenessUpdate(awarenessRef.value, new Uint8Array(data), null)
    })

    getSync((data, peerId) => {
      if (!ydoc) return
      const sv = new Uint8Array(data)
      const update = Y.encodeStateAsUpdate(ydoc, sv)
      sendSyncReply(update, peerId)
    })

    getSyncReply((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      sendYjsUpdate?.(update)
    })

    awareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = [...added, ...updated, ...removed]
        const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        sendAwareness?.(encodedUpdate)
      }
    )

    room.onPeerJoin((peerId) => {
      state.value.connected = true
      const sv = Y.encodeStateVector(ydoc!)
      sendSyncStep1?.(sv, peerId)

      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
      sendAwareness?.(encodedUpdate, peerId)

      for (const cb of peerJoinCallbacks) cb(peerId)
    })

    room.onPeerLeave((peerId) => {
      const remoteClients = [...awareness.getStates().keys()].filter(
        (id) => id !== awareness.clientID
      )
      awarenessProtocol.removeAwarenessStates(awareness, remoteClients, 'peer-left')
      updatePeersList()

      for (const cb of peerLeaveCallbacks) cb(peerId)
    })

    state.value.connected = true
    broadcastAwareness()

    watch(
      () => store.state.zoom,
      (zoom) => {
        if (!awarenessRef.value) return
        const prev = awarenessRef.value.getLocalState()?.cursor as
          | { x: number; y: number; pageId: string; zoom: number }
          | undefined
        if (prev) {
          awarenessRef.value.setLocalStateField('cursor', { ...prev, zoom })
        }
      }
    )

    const origUpdateNode = store.graph.updateNode.bind(store.graph)
    store.graph.updateNode = (id: string, changes: Partial<SceneNode>) => {
      origUpdateNode(id, changes)
      if (!suppressGraphEvents && ydoc && ynodes) {
        syncNodeToYjs(id)
      }
    }
  }

  function disconnect() {
    onDisconnectVoice?.()
    roomRef.value?.leave()
    roomRef.value = null
    sendYjsUpdate = null
    sendAwareness = null
    sendSyncStep1 = null

    if (awarenessRef.value) {
      awarenessRef.value.destroy()
      awarenessRef.value = null
    }
    if (persistence) {
      persistence.destroy()
      persistence = null
    }
    if (ydoc) {
      ydoc.destroy()
      ydoc = null
    }
    ynodes = null
    state.value.connected = false
    state.value.roomId = null
    state.value.peers = []
    store.state.remoteCursors = []
    store.requestRender()
  }

  function registerVoiceCleanup(fn: () => void) {
    onDisconnectVoice = fn
  }

  function onPeerJoin(fn: (peerId: string) => void) {
    peerJoinCallbacks.push(fn)
  }

  function onPeerLeave(fn: (peerId: string) => void) {
    peerLeaveCallbacks.push(fn)
  }

  function syncNodeToYjs(nodeId: string) {
    if (!ydoc || !ynodes) return
    const node = store.graph.getNode(nodeId)
    if (!node) return

    suppressYjsEvents = true
    ydoc.transact(() => {
      let ynode = ynodes!.get(nodeId)
      if (!ynode) {
        ynode = new Y.Map()
        ynodes!.set(nodeId, ynode)
      }
      syncNodePropsToYMap(node, ynode)
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
    if (!ydoc || !ynodes) return
    suppressYjsEvents = true
    ydoc.transact(() => {
      for (const node of store.graph.getAllNodes()) {
        let ynode = ynodes!.get(node.id)
        if (!ynode) {
          ynode = new Y.Map()
          ynodes!.set(node.id, ynode)
        }
        syncNodePropsToYMap(node, ynode)
      }
    })
    suppressYjsEvents = false
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    for (const event of events) {
      if (event.target === ynodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'add') {
            const ynode = ynodes!.get(key)
            if (ynode) applyYnodeToGraph(key, ynode)
          } else if (change.action === 'delete') {
            store.graph.deleteNode(key)
          }
        }
      } else if (event.target.parent === ynodes) {
        const nodeId = findNodeIdForYMap(event.target as Y.Map<unknown>)
        if (nodeId) {
          const ynode = ynodes!.get(nodeId)
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
    if (!awarenessRef.value) return
    awarenessRef.value.setLocalStateField('user', {
      name: state.value.localName,
      color: state.value.localColor
    })
  }

  function updateCursor(x: number, y: number, pageId: string) {
    if (!awarenessRef.value) return
    awarenessRef.value.setLocalStateField('cursor', { x, y, pageId, zoom: store.state.zoom })
  }

  function updateSelection(ids: string[]) {
    if (!awarenessRef.value) return
    awarenessRef.value.setLocalStateField('selection', ids)
  }

  function updatePeersList() {
    if (!awarenessRef.value) return
    const states = awarenessRef.value.getStates()
    const peers: RemotePeer[] = []
    const localClientId = awarenessRef.value.clientID
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
        selection: peerState.selection as string[],
        voice: peerState.voice as VoiceState | undefined
      })
    })

    state.value.peers = peers
    store.state.remoteCursors = peers
      .filter((p) => p.cursor && p.cursor.pageId === currentPageId)
      .map((p) => ({
        name: p.name,
        color: p.color,
        x: p.cursor!.x,
        y: p.cursor!.y,
        selection: p.selection
      }))
    store.requestRender()
  }

  function setLocalName(name: string) {
    state.value.localName = name
    localStorage.setItem('op-collab-name', name)
    broadcastAwareness()
  }

  function generateRoomId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH))
    let result = ''
    for (let i = 0; i < ROOM_ID_LENGTH; i++) {
      result += ROOM_ID_CHARS[bytes[i] % ROOM_ID_CHARS.length]
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
    if (!followingPeer.value || !awarenessRef.value) return
    const peerState = awarenessRef.value.getStates().get(followingPeer.value)
    if (!peerState?.cursor) {
      followingPeer.value = null
      return
    }
    const cursor = peerState.cursor as { x: number; y: number; pageId: string; zoom?: number }
    if (cursor.pageId !== store.state.currentPageId) {
      store.switchPage(cursor.pageId)
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
    roomRef,
    awarenessRef,
    connect: joinRoom,
    disconnect,
    shareCurrentDoc,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow,
    registerVoiceCleanup,
    onPeerJoin,
    onPeerLeave
  }
}

export type CollabReturn = ReturnType<typeof useCollab>
export const COLLAB_KEY = Symbol('collab') as InjectionKey<CollabReturn>
export function useCollabInjected() {
  return inject(COLLAB_KEY)
}
