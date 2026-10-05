import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { buildRemotePeers } from '@/app/collab/awareness'
import { useCollabIdentity } from '@/app/collab/identity'
import { publishLocalAgents } from '@/app/collab/local-awareness'
import { connectCollabRoom } from '@/app/collab/room/connection'
import { deriveRoomStatus, type RoomStatus } from '@/app/collab/room/status'
import {
  readRoomName,
  readRoot,
  TREE_FORMAT,
  writeRoomName,
  type YNodes
} from '@/app/collab/shared-tree/fields'
import type { JoinCollabRoom } from '@/app/collab/transport'
import type { RemotePeer } from '@/app/collab/types'
import {
  bindCollabGraphEvents,
  createYjsGraphSync,
  registerYjsObservers
} from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { setPeers } from '@/app/presence/registry'
import { ROOM_JOIN_GRACE_MS } from '@/constants'

/** How a tab came to be in a room: by sharing its own document, or by joining someone's. */
export type RoomOrigin = 'shared' | 'joined'

/** One room, live in one tab: its document, presence, connection, and saved copy. */
export interface RoomSession {
  readonly roomId: string
  readonly store: EditorStore
  readonly origin: RoomOrigin
  readonly peers: Readonly<Ref<RemotePeer[]>>
  readonly status: ComputedRef<RoomStatus>
  /** Whether the room's document has reached this tab, from a peer or the saved copy. */
  readonly hasDocument: Readonly<Ref<boolean>>
  updateCursor(x: number, y: number, pageId: string): void
  updateSelection(ids: string[]): void
  /** Writes the tab's whole document into the room and makes its root the room's. */
  shareDocument(): void
  /** Leaves the room and releases its connection, presence, and saved-copy handle. */
  dispose(): void
}

/** This device's saved copy of a room, so it opens before anyone else is online. */
export interface RoomSavedCopy {
  whenSynced: Promise<unknown>
  destroy(): unknown
}

export interface RoomSessionOptions {
  roomId: string
  store: EditorStore
  origin: RoomOrigin
  joinRoom?: JoinCollabRoom
  openSavedCopy?: (roomId: string, ydoc: Y.Doc) => RoomSavedCopy
  /** How long the tab says it is joining before it says nobody with the room is online. */
  graceMs?: number
}

function openIndexedDBCopy(roomId: string, ydoc: Y.Doc): RoomSavedCopy {
  return new IndexeddbPersistence(`op-room-${roomId}`, ydoc)
}

type CursorState = { x: number; y: number; pageId: string; zoom: number }

export function openRoomSession({
  roomId,
  store,
  origin,
  joinRoom,
  openSavedCopy = openIndexedDBCopy,
  graceMs = ROOM_JOIN_GRACE_MS
}: RoomSessionOptions): RoomSession {
  const identity = useCollabIdentity()
  const ydoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(ydoc)
  const ynodes: YNodes = ydoc.getMap('nodes')
  const yimages = ydoc.getMap<Uint8Array>('images')
  const meta = ydoc.getMap<unknown>('meta')
  const persistence = openSavedCopy(roomId, ydoc)

  const peers = shallowRef<RemotePeer[]>([])
  const hasDocument = ref(false)
  const savedCopyLoaded = ref(false)
  const waitedLong = ref(false)
  let suppressYjsEvents = false
  let suppressGraphSync = false
  let disposed = false

  const status = computed(() =>
    deriveRoomStatus({
      hasDocument: hasDocument.value,
      savedCopyLoaded: savedCopyLoaded.value,
      waitedLong: waitedLong.value,
      peerCount: peers.value.length
    })
  )

  const sync = createYjsGraphSync({
    getStore: () => store,
    getYdoc: () => (disposed ? null : ydoc),
    getYnodes: () => (disposed ? null : ynodes),
    getYimages: () => (disposed ? null : yimages),
    setSuppressYjsEvents: (value) => {
      suppressYjsEvents = value
    }
  })

  function refreshDocument() {
    const rootId = readRoot(meta)
    hasDocument.value = rootId !== undefined && store.graph.rootId === rootId
    const name = readRoomName(meta)
    if (hasDocument.value && name && origin === 'joined') store.state.documentName = name
  }

  function updatePeers() {
    const next = buildRemotePeers(
      awareness.getStates() as Map<number, Record<string, unknown>>,
      awareness.clientID
    )
    peers.value = next
    setPeers(store, next)
  }

  function broadcastIdentity() {
    awareness.setLocalStateField('user', { name: identity.name.value, color: identity.color })
    awareness.setLocalStateField('treeFormat', TREE_FORMAT)
  }

  registerYjsObservers({
    store,
    ynodes,
    yimages,
    getSuppressYjsEvents: () => suppressYjsEvents,
    setSuppressGraphSync: (value) => {
      suppressGraphSync = value
    },
    applyYjsToGraph: (events) => {
      sync.applyYjsToGraph(events)
      refreshDocument()
    }
  })
  meta.observe(refreshDocument)
  awareness.on('change', updatePeers)

  const connection = connectCollabRoom({
    roomId,
    ydoc,
    awareness,
    updatePeersList: updatePeers,
    joinRoom
  })
  broadcastIdentity()

  void persistence.whenSynced.then(() => {
    if (disposed) return undefined
    savedCopyLoaded.value = true
    refreshDocument()
    return undefined
  })
  const graceTimer = setTimeout(() => {
    waitedLong.value = true
  }, graceMs)

  const stopNameWatch = watch(identity.name, broadcastIdentity)
  const stopZoomWatch = store.onEditorEvent('viewport:changed', (viewport) => {
    const cursor = awareness.getLocalState()?.cursor as CursorState | undefined
    if (cursor) awareness.setLocalStateField('cursor', { ...cursor, zoom: viewport.zoom })
  })
  const stopAgentSync = publishLocalAgents(store, () => awareness, identity.color)
  const unbindGraphEvents = bindCollabGraphEvents({
    store,
    getYdoc: () => (disposed ? null : ydoc),
    getYnodes: () => (disposed ? null : ynodes),
    getSuppressGraphSync: () => suppressGraphSync,
    syncLocalEdit: sync.syncLocalEdit
  })

  return {
    roomId,
    store,
    origin,
    peers,
    status,
    hasDocument,
    updateCursor(x, y, pageId) {
      awareness.setLocalStateField('cursor', { x, y, pageId, zoom: store.state.zoom })
    },
    updateSelection(ids) {
      awareness.setLocalStateField('selection', ids)
    },
    shareDocument() {
      sync.syncAllNodesToYjs()
      writeRoomName(meta, store.state.documentName)
      refreshDocument()
    },
    dispose() {
      if (disposed) return
      // Unbinding writes an edit still waiting to be sent, so it runs while the room is open.
      unbindGraphEvents()
      disposed = true
      clearTimeout(graceTimer)
      stopNameWatch()
      stopZoomWatch()
      stopAgentSync()
      meta.unobserve(refreshDocument)
      void connection.room.leave()
      awareness.destroy()
      void persistence.destroy()
      ydoc.destroy()
      setPeers(store, [])
    }
  }
}
