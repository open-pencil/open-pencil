import { useIntervalFn } from '@vueuse/core'
import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { shareAgentPreviews } from '@/app/collab/agent-preview'
import { buildRemotePeers } from '@/app/collab/awareness'
import { bindDocumentSync, roomDocumentData } from '@/app/collab/document/sync'
import { useCollabIdentity } from '@/app/collab/identity'
import { bindRoomImages, type RoomImageStore } from '@/app/collab/images'
import { publishLocalAgents } from '@/app/collab/local-awareness'
import type { YRecords } from '@/app/collab/records'
import { connectCollabRoom } from '@/app/collab/room/connection'
import { trackRoomSaves, type RoomSaves } from '@/app/collab/room/saves'
import { deriveRoomStatus, type RoomStatus } from '@/app/collab/room/status'
import {
  readRoomName,
  readRoot,
  TREE_FORMAT,
  writeRoomName,
  type YNodes
} from '@/app/collab/shared-tree/fields'
import type { JoinCollabRoom } from '@/app/collab/transport'
import type { CollabAction } from '@/app/collab/transport/types'
import type { RemotePeer } from '@/app/collab/types'
import { bindVariableSync } from '@/app/collab/variables'
import { attachRoomVoice, type RoomVoice } from '@/app/collab/voice/room'
import {
  bindCollabGraphEvents,
  createYjsGraphSync,
  registerYjsObservers
} from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { setPeers } from '@/app/presence/registry'
import { ROOM_STATUS_TICK_MS, ROOM_UNREACHABLE_MS } from '@/constants'

/** How a tab came to be in a room: by sharing its own document, or by joining someone's. */
export type RoomOrigin = 'shared' | 'joined'

/** Who this tab is in a room: the name and color everyone sees, this tab included. */
export type RoomIdentity = { name: Readonly<Ref<string>>; color: Color }

/** One room, live in one tab: its document, presence, connection, and saved copy. */
export interface RoomSession {
  readonly roomId: string
  readonly store: EditorStore
  readonly origin: RoomOrigin
  readonly peers: Readonly<Ref<RemotePeer[]>>
  readonly status: ComputedRef<RoomStatus>
  /** Whether the room's document has reached this tab, from a peer or the saved copy. */
  readonly hasDocument: Readonly<Ref<boolean>>
  readonly voice: RoomVoice
  /** Who this tab is in the room. */
  readonly identity: RoomIdentity
  /** Whether the person may leave; a stored document's room stays open while its tab does. */
  readonly leavable: boolean
  /** What of the room's document its stored revisions hold. */
  readonly saves: RoomSaves
  updateCursor(x: number, y: number, pageId: string): void
  updateSelection(ids: string[]): void
  /** Writes the tab's whole document into the room and makes its root the room's. */
  shareDocument(): void
  /** Whether the room holds a document yet, from any peer. */
  roomHasDocument(): boolean
  /** Follow peers answering this tab's state with theirs; returns the unsubscribe. */
  onSynced(handler: (peerId: string) => void): () => void
  /** Follow the server saying the document's version history changed; returns the unsubscribe. */
  onVersionsChanged(handler: () => void): () => void
  /** The awareness states of everyone in the room, this tab included. */
  presence(): ReadonlyMap<number, Record<string, unknown>>
  /** This tab's awareness client. */
  readonly clientId: number
  /** The peer whose presence carries a client, to address it alone. */
  peerForClient(clientId: number): string | undefined
  /** The room's channel for asking whoever saves its document to upload it now. */
  readonly upload: CollabAction
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
  /** Who this tab is in the room; the device's own identity unless a host stands in for one. */
  identity?: RoomIdentity
  openSavedCopy?: (roomId: string, ydoc: Y.Doc) => RoomSavedCopy
  /** How long the tab tries to reach the service that introduces peers before saying it cannot. */
  unreachableMs?: number
  /** How often the tab rechecks its connection while it waits for the file. */
  tickMs?: number
  /**
   * The tab already shows the room's document, as a stored document opened before its room was:
   * it counts as having the document until the room says it holds another, and what it takes
   * from the room is no edit of its own, since the room says what is unsaved.
   */
  holdsDocument?: boolean
  /** False for a room the tab's document lives in, which the person never leaves by hand. */
  leavable?: boolean
  /** Where the room keeps its images instead of in its document, as a Cloud room does. */
  images?: RoomImageStore
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
  identity = useCollabIdentity(),
  openSavedCopy = openIndexedDBCopy,
  unreachableMs = ROOM_UNREACHABLE_MS,
  tickMs = ROOM_STATUS_TICK_MS,
  holdsDocument = false,
  leavable = true,
  images
}: RoomSessionOptions): RoomSession {
  const ydoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(ydoc)
  const ynodes: YNodes = ydoc.getMap('nodes')
  const yimages = ydoc.getMap<Uint8Array>('images')
  const roomImages = images
    ? bindRoomImages({
        ydoc,
        yimages,
        yrefs: ydoc.getMap<string>('imageRefs'),
        store,
        images,
        report: (message, error) => console.error(`[Collab] ${message}:`, error)
      })
    : null
  const meta = ydoc.getMap<unknown>('meta')
  const yvariables: YRecords = ydoc.getMap('variables')
  const ycollections: YRecords = ydoc.getMap('collections')
  const documentData = roomDocumentData(ydoc)
  const persistence = openSavedCopy(roomId, ydoc)
  const saves = trackRoomSaves(ydoc, [
    meta,
    ynodes,
    yimages,
    yvariables,
    ycollections,
    documentData.entries,
    documentData.threads,
    documentData.libraries,
    documentData.settings
  ])
  const documentSync = bindDocumentSync({ store, ydoc, data: documentData, meta })
  const adopt = (apply: () => void) => (holdsDocument ? store.adoptChanges(apply) : apply())

  const peers = shallowRef<RemotePeer[]>([])
  // A tab that holds the document shows it from the start; the room's screen would replace it.
  const hasDocument = ref(holdsDocument)
  const savedCopyLoaded = ref(false)
  const openedAt = Date.now()
  const now = ref(openedAt)
  /** When the current stretch of being connected to the service that introduces peers began. */
  const connectedSince = ref<number | null>(null)
  let suppressYjsEvents = false
  let suppressGraphSync = false
  /** Whether a tab that holds a stored document has given way to the room's copy of it. */
  let followsRoom = false
  let disposed = false

  const status = computed(() =>
    deriveRoomStatus({
      // A tab that holds the document keeps showing it while the room's copy arrives in parts:
      // the room's root can come before its layers, and the tab follows it once they are here.
      hasDocument: holdsDocument || hasDocument.value,
      savedCopyLoaded: savedCopyLoaded.value,
      openFor: now.value - openedAt,
      connectedFor: connectedSince.value === null ? null : now.value - connectedSince.value,
      discoveryMs: connection.room.discoveryMs,
      unreachableMs,
      peerCount: peers.value.length,
      peersWithFile: peers.value.filter((peer) => peer.hasFile).length
    })
  )

  const sync = createYjsGraphSync({
    getStore: () => store,
    getYdoc: () => (disposed ? null : ydoc),
    getYnodes: () => (disposed ? null : ynodes),
    getYimages: () => (disposed ? null : yimages),
    shareImage: roomImages ? (name, bytes) => roomImages.share(name, bytes) : undefined,
    setSuppressYjsEvents: (value) => {
      suppressYjsEvents = value
    }
  })

  function refreshDocument() {
    if (disposed) return
    const rootId = readRoot(meta)
    hasDocument.value = rootId === undefined ? holdsDocument : store.graph.rootId === rootId
    // The room's document is what a stored document's tab shows once the room holds it.
    if (holdsDocument && hasDocument.value && rootId !== undefined && !followsRoom) {
      followsRoom = true
      suppressGraphSync = true
      try {
        // What the person drew while the room loaded is theirs; the rest is the file's copy.
        sync.syncHeldBackEdits()
        adopt(sync.dropLayersOutsideRoom)
      } finally {
        suppressGraphSync = false
      }
    }
    if (hasDocument.value) documentSync.follow()
    // Newcomers wait for someone who has the file, so peers say whether they do.
    if (awareness.getLocalState()?.hasFile !== hasDocument.value) {
      awareness.setLocalStateField('hasFile', hasDocument.value)
    }
    const name = readRoomName(meta)
    if (hasDocument.value && name) store.state.documentName = name
  }

  function updatePeers() {
    const next = buildRemotePeers(awareness.getStates(), awareness.clientID)
    peers.value = next
    setPeers(store, next)
  }

  function broadcastIdentity() {
    awareness.setLocalStateField('user', { name: identity.name.value, color: identity.color })
    awareness.setLocalStateField('treeFormat', TREE_FORMAT)
  }

  const unregisterYjsObservers = registerYjsObservers({
    store,
    ynodes,
    yimages,
    hasImageRef: roomImages ? (name) => roomImages.hasRef(name) : undefined,
    getSuppressYjsEvents: () => suppressYjsEvents,
    setSuppressGraphSync: (value) => {
      suppressGraphSync = value
    },
    applyYjsToGraph: (events) => {
      adopt(() => sync.applyYjsToGraph(events))
      refreshDocument()
    }
  })
  meta.observe(refreshDocument)
  const stopName = watch(
    () => store.state.documentName,
    (name) => {
      if (
        disposed ||
        store.state.readOnly ||
        !hasDocument.value ||
        readRoot(meta) !== store.graph.rootId ||
        name === readRoomName(meta)
      )
        return
      writeRoomName(meta, name)
    },
    { flush: 'sync' }
  )
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
  // Signaling services report no events, so the tab polls while it waits for the file.
  function checkConnection() {
    now.value = Date.now()
    if (!connection.room.signalingConnected()) connectedSince.value = null
    else connectedSince.value ??= now.value
  }
  checkConnection()
  const connectionTimer = useIntervalFn(() => {
    if (!hasDocument.value) checkConnection()
  }, tickMs)

  const stopNameWatch = watch(identity.name, broadcastIdentity)
  const stopZoomWatch = store.onEditorEvent('viewport:changed', (viewport) => {
    const cursor = awareness.getLocalState()?.cursor as CursorState | undefined
    if (cursor) awareness.setLocalStateField('cursor', { ...cursor, zoom: viewport.zoom })
  })
  const stopAgentSync = publishLocalAgents(store, () => awareness, identity.color)
  const stopAgentPreviews = shareAgentPreviews(store, connection)
  const voice = attachRoomVoice({ awareness, peers, connection })
  const variableSync = bindVariableSync({ store, ydoc, yvariables, ycollections })
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
    voice,
    identity,
    leavable,
    saves,
    updateCursor(x, y, pageId) {
      awareness.setLocalStateField('cursor', { x, y, pageId, zoom: store.state.zoom })
    },
    updateSelection(ids) {
      awareness.setLocalStateField('selection', ids)
    },
    shareDocument() {
      // Before the root is claimed, which makes the tab follow the room's document data.
      documentSync.share()
      sync.syncAllNodesToYjs()
      variableSync.share()
      writeRoomName(meta, store.state.documentName)
      refreshDocument()
    },
    roomHasDocument: () => readRoot(meta) !== undefined,
    onSynced: (handler) => connection.onSynced(handler),
    onVersionsChanged: (handler) => connection.onVersionsChanged(handler),
    presence: () => awareness.getStates(),
    clientId: awareness.clientID,
    peerForClient: (clientId) => connection.peerForClient(clientId),
    upload: connection.upload,
    dispose() {
      if (disposed) return
      stopName()
      // Unbinding writes an edit still waiting to be sent, so it runs while the room is open.
      unbindGraphEvents()
      variableSync.dispose()
      documentSync.dispose()
      roomImages?.dispose()
      disposed = true
      connectionTimer.pause()
      stopNameWatch()
      stopZoomWatch()
      stopAgentSync()
      stopAgentPreviews()
      voice.dispose()
      meta.unobserve(refreshDocument)
      unregisterYjsObservers()
      saves.dispose()
      // Destroying the awareness can emit a last change; nothing here should react to it.
      awareness.off('change', updatePeers)
      void connection.room.leave()
      awareness.destroy()
      void persistence.destroy()
      ydoc.destroy()
      peers.value = []
      setPeers(store, [])
    }
  }
}
