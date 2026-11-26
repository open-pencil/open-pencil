import { useIntervalFn } from '@vueuse/core'
import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import type * as Y from 'yjs'

import {
  deriveRoomStatus,
  openCollabRoom,
  type CollabAction,
  type JoinCollabRoom,
  type RoomImageStore,
  type RoomSavedCopy,
  type RoomSaves,
  type RoomStatus
} from '@open-pencil/collab'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { shareAgentPreviews } from '@/app/collab/agent-preview'
import { buildRemotePeers } from '@/app/collab/awareness'
import { collabEditor } from '@/app/collab/editor'
import { useCollabIdentity } from '@/app/collab/identity'
import { publishLocalAgents } from '@/app/collab/local-awareness'
import { joinCollabRoom } from '@/app/collab/transport'
import type { RemotePeer } from '@/app/collab/types'
import { attachRoomVoice, type RoomVoice } from '@/app/collab/voice/room'
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
  /** Follow peers leaving the room, the relay included; returns the unsubscribe. */
  onPeerLeave(handler: (peerId: string) => void): () => void
  /** Follow the server saying the document's version history changed; returns the unsubscribe. */
  onVersionsChanged(handler: () => void): () => void
  /** Follow the server saying a comment thread changed, by its ID; returns the unsubscribe. */
  onCommentsChanged(handler: (threadId: string) => void): () => void
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
  /** Whether the document's server keeps its comments, as Cloud does, so the room leaves them out. */
  commentsOnServer?: boolean
}

function openIndexedDBCopy(roomId: string, ydoc: Y.Doc): RoomSavedCopy {
  return new IndexeddbPersistence(`op-room-${roomId}`, ydoc)
}

type CursorState = { x: number; y: number; pageId: string; zoom: number }

/**
 * A room in a tab: the room's document kept in step with the tab's editor by `openCollabRoom`,
 * with what the app adds around it: this device's saved copy, presence of people and agents, the
 * voice call, and the status the room's screen shows while the file is on its way.
 */
export function openRoomSession({
  roomId,
  store,
  origin,
  joinRoom = joinCollabRoom,
  identity = useCollabIdentity(),
  openSavedCopy = openIndexedDBCopy,
  unreachableMs = ROOM_UNREACHABLE_MS,
  tickMs = ROOM_STATUS_TICK_MS,
  holdsDocument = false,
  leavable = true,
  images,
  commentsOnServer = false
}: RoomSessionOptions): RoomSession {
  const room = openCollabRoom({
    roomId,
    editor: collabEditor(store),
    joinRoom,
    openSavedCopy,
    holdsDocument,
    images: images ? { store: images, owner: store } : undefined,
    commentsOnServer
  })
  const { awareness, connection } = room

  const peers = shallowRef<RemotePeer[]>([])
  const hasDocument = ref(room.hasDocument())
  const savedCopyLoaded = ref(room.savedCopyLoaded())
  const openedAt = Date.now()
  const now = ref(openedAt)
  /** When the current stretch of being connected to the service that introduces peers began. */
  const connectedSince = ref<number | null>(null)

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

  const stopChanges = room.onChange(() => {
    hasDocument.value = room.hasDocument()
    savedCopyLoaded.value = room.savedCopyLoaded()
  })

  function updatePeers() {
    const next = buildRemotePeers(awareness.getStates(), awareness.clientID)
    peers.value = next
    setPeers(store, next)
  }
  const stopPresence = room.onPresenceChange(updatePeers)

  function broadcastIdentity() {
    awareness.setLocalStateField('user', { name: identity.name.value, color: identity.color })
  }
  broadcastIdentity()

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
  let disposed = false

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
    saves: room.saves,
    updateCursor(x, y, pageId) {
      awareness.setLocalStateField('cursor', { x, y, pageId, zoom: store.state.zoom })
    },
    updateSelection(ids) {
      awareness.setLocalStateField('selection', ids)
    },
    shareDocument: () => room.shareDocument(),
    roomHasDocument: () => room.roomHasDocument(),
    onSynced: (handler) => connection.onSynced(handler),
    onPeerLeave: (handler) => connection.onPeerLeave(handler),
    onVersionsChanged: (handler) => connection.onVersionsChanged(handler),
    onCommentsChanged: (handler) => connection.onCommentsChanged(handler),
    presence: () => awareness.getStates(),
    clientId: awareness.clientID,
    peerForClient: (clientId) => connection.peerForClient(clientId),
    upload: connection.upload,
    dispose() {
      if (disposed) return
      disposed = true
      connectionTimer.pause()
      stopNameWatch()
      stopZoomWatch()
      stopAgentSync()
      stopAgentPreviews()
      voice.dispose()
      stopChanges()
      stopPresence()
      room.dispose()
      peers.value = []
      setPeers(store, [])
    }
  }
}
