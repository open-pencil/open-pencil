import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { isAbortError } from '@open-pencil/std/errors'

import { bindDocumentSync, roomDocumentData } from '../document/sync'
import type { CollabEditor } from '../editor'
import { bindCollabGraphEvents, createYjsGraphSync, registerYjsObservers } from '../graph-sync'
import type { YRecords } from '../records'
import { trackRoomSaves, type RoomSaves } from '../saves'
import {
  readRoomName,
  readRoot,
  TREE_FORMAT,
  writeRoomName,
  type YNodes
} from '../shared-tree/fields'
import { bindVariableSync } from '../variables'
import { connectCollabRoom, type CollabRoomConnection } from './connection'
import { bindRoomImages, type RoomImageStore } from './images'
import type { JoinCollabRoom } from './transport'

/**
 * What a room needs of the editor that shows its document, beyond what keeps the graph in step:
 * the page it shows, the document's name, and a way to take the room's changes as no edit.
 */
export interface RoomEditor extends CollabEditor {
  /** Applies changes the document already has elsewhere, such as the room's, as no edit. */
  adoptChanges(apply: () => void): void
  /** The page the editor shows now. */
  readonly currentPageId: string
  switchPage(pageId: string): Promise<void>
  /** The document's name, which sharing gives the room. */
  readonly documentName: string
  /** Shows the room's name as the document's. */
  setDocumentName(name: string): void
  /** Calls back with each name the person gives the document; returns the unsubscribe. */
  onDocumentRenamed(handler: (name: string) => void): () => void
}

/** This device's saved copy of a room, so it opens before anyone else is online. */
export interface RoomSavedCopy {
  whenSynced: Promise<unknown>
  destroy(): unknown
}

export interface CollabRoomOptions {
  roomId: string
  editor: RoomEditor
  joinRoom: JoinCollabRoom
  /** This device's saved copy of the room; without one, the room has only what peers send. */
  openSavedCopy?: (roomId: string, ydoc: Y.Doc) => RoomSavedCopy
  /**
   * The editor already shows the room's document, as a stored document opened before its room
   * was: it counts as having the document until the room says it holds another, and what it
   * takes from the room is no edit of its own, since the room says what is unsaved.
   */
  holdsDocument?: boolean
  /** Where the room keeps its images instead of in its document, as a Cloud room does. */
  images?: { store: RoomImageStore; owner: object }
  /** Whether the document's server keeps its comments, as Cloud does, so the room leaves them out. */
  commentsOnServer?: boolean
  /**
   * Whether this peer is present to the others. Off, it publishes no presence at all, as a
   * document shown inside another site's page watches the room without joining the people in it.
   */
  presence?: boolean
  /** Where failures the room recovers from are reported; the console by default. */
  report?: (message: string, error: unknown) => void
}

/**
 * One room's document kept in step with an editor: its layers, variables, document data, and
 * images, over a transport, with this peer's presence. Who the peer is and what else it shares
 * in presence are the host's, through `awareness`.
 */
export interface CollabRoom {
  readonly roomId: string
  readonly ydoc: Y.Doc
  readonly awareness: awarenessProtocol.Awareness
  readonly connection: CollabRoomConnection
  /** What of the room's document its stored revisions hold. */
  readonly saves: RoomSaves
  /** Whether the room's document has reached the editor, from a peer or the saved copy. */
  hasDocument(): boolean
  /** Whether this device's saved copy of the room has loaded; true at once without one. */
  savedCopyLoaded(): boolean
  /** Follow `hasDocument` and `savedCopyLoaded` changing; returns the unsubscribe. */
  onChange(handler: () => void): () => void
  /** Follow everyone's presence changing, peers leaving included; returns the unsubscribe. */
  onPresenceChange(handler: () => void): () => void
  /** Writes the editor's whole document into the room and makes its root the room's. */
  shareDocument(): void
  /** Whether the room holds a document yet, from any peer. */
  roomHasDocument(): boolean
  /** Leaves the room and releases its connection, presence, and saved-copy handle. */
  dispose(): void
}

const NO_SAVED_COPY: RoomSavedCopy = { whenSynced: Promise.resolve(), destroy: () => undefined }

/**
 * Moves the editor to one of the room's pages when the page it shows is gone, as after a peer
 * deleted it or the editor dropped its file's own pages for the room's.
 */
export function followRoomPages(
  editor: Pick<RoomEditor, 'graph' | 'currentPageId' | 'switchPage'>,
  report: (message: string, error: unknown) => void
): () => void {
  let pending: string | undefined
  return () => {
    const pages = editor.graph.getPages()
    if (pages.length === 0 || pages.some((page) => page.id === editor.currentPageId)) return
    const pageId = pages[0].id
    if (pending === pageId) return
    pending = pageId
    void editor
      .switchPage(pageId)
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        report('Failed to switch to a synced page', error)
      })
      .finally(() => {
        if (pending === pageId) pending = undefined
      })
  }
}

export function openCollabRoom({
  roomId,
  editor,
  joinRoom,
  openSavedCopy,
  holdsDocument = false,
  images,
  commentsOnServer = false,
  presence = true,
  report = (message, error) => console.error(`[Collab] ${message}:`, error)
}: CollabRoomOptions): CollabRoom {
  const ydoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(ydoc)
  const ynodes: YNodes = ydoc.getMap('nodes')
  const yimages = ydoc.getMap<Uint8Array>('images')
  const roomImages = images
    ? bindRoomImages({
        ydoc,
        yimages,
        yrefs: ydoc.getMap<string>('imageRefs'),
        editor,
        owner: images.owner,
        images: images.store,
        report
      })
    : null
  const meta = ydoc.getMap<unknown>('meta')
  const yvariables: YRecords = ydoc.getMap('variables')
  const ycollections: YRecords = ydoc.getMap('collections')
  const documentData = roomDocumentData(ydoc)
  const persistence = openSavedCopy?.(roomId, ydoc) ?? NO_SAVED_COPY
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
  const documentSync = bindDocumentSync({
    editor,
    ydoc,
    data: documentData,
    meta,
    comments: !commentsOnServer
  })
  const adopt = (apply: () => void) => (holdsDocument ? editor.adoptChanges(apply) : apply())

  const changeHandlers = new Set<() => void>()
  const presenceHandlers = new Set<() => void>()
  const changed = () => {
    for (const handler of changeHandlers) handler()
  }
  const presenceChanged = () => {
    for (const handler of presenceHandlers) handler()
  }

  // An editor that holds the document shows it from the start; the room's would replace it.
  let hasDocument = holdsDocument
  let savedCopyLoaded = openSavedCopy === undefined
  let suppressYjsEvents = false
  let suppressGraphSync = false
  /** Whether an editor that holds a stored document has given way to the room's copy of it. */
  let followsRoom = false
  let disposed = false

  const sync = createYjsGraphSync({
    getEditor: () => editor,
    getYdoc: () => (disposed ? null : ydoc),
    getYnodes: () => (disposed ? null : ynodes),
    getYimages: () => (disposed ? null : yimages),
    shareImage: roomImages ? (name, bytes) => roomImages.share(name, bytes) : undefined,
    setSuppressYjsEvents: (value) => {
      suppressYjsEvents = value
    },
    onApplied: followRoomPages(editor, report)
  })

  function refreshDocument() {
    if (disposed) return
    const rootId = readRoot(meta)
    const had = hasDocument
    hasDocument = rootId === undefined ? holdsDocument : editor.graph.rootId === rootId
    // The room's document is what a stored document's editor shows once the room holds it.
    if (holdsDocument && hasDocument && rootId !== undefined && !followsRoom) {
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
    if (hasDocument) documentSync.follow()
    // Newcomers wait for someone who has the file, so peers say whether they do.
    if (presence && awareness.getLocalState()?.hasFile !== hasDocument) {
      awareness.setLocalStateField('hasFile', hasDocument)
    }
    const name = readRoomName(meta)
    if (hasDocument && name) editor.setDocumentName(name)
    if (had !== hasDocument) changed()
  }

  const unregisterYjsObservers = registerYjsObservers({
    editor,
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
  // A rename reaches the room once the editor shows the room's copy; before that the room's name
  // wins, as the room's other document data does when the editor starts following it.
  const stopName = editor.onDocumentRenamed((name) => {
    if (disposed || editor.isReadOnly() || !hasDocument) return
    if (readRoot(meta) !== editor.graph.rootId || name === readRoomName(meta)) return
    writeRoomName(meta, name)
  })
  awareness.on('change', presenceChanged)

  const connection = connectCollabRoom({
    roomId,
    ydoc,
    awareness,
    updatePeersList: presenceChanged,
    joinRoom
  })
  if (presence) awareness.setLocalStateField('treeFormat', TREE_FORMAT)
  else awareness.setLocalState(null)

  void persistence.whenSynced.then(() => {
    if (disposed) return undefined
    savedCopyLoaded = true
    refreshDocument()
    changed()
    return undefined
  })

  const variableSync = bindVariableSync({ editor, ydoc, yvariables, ycollections })
  const unbindGraphEvents = bindCollabGraphEvents({
    editor,
    getYdoc: () => (disposed ? null : ydoc),
    getYnodes: () => (disposed ? null : ynodes),
    getSuppressGraphSync: () => suppressGraphSync,
    syncLocalEdit: sync.syncLocalEdit
  })

  return {
    roomId,
    ydoc,
    awareness,
    connection,
    saves,
    hasDocument: () => hasDocument,
    savedCopyLoaded: () => savedCopyLoaded,
    onChange(handler) {
      changeHandlers.add(handler)
      return () => changeHandlers.delete(handler)
    },
    onPresenceChange(handler) {
      presenceHandlers.add(handler)
      return () => presenceHandlers.delete(handler)
    },
    shareDocument() {
      // Before the root is claimed, which makes the editor follow the room's document data.
      documentSync.share()
      sync.syncAllNodesToYjs()
      variableSync.share()
      writeRoomName(meta, editor.documentName)
      refreshDocument()
    },
    roomHasDocument: () => readRoot(meta) !== undefined,
    dispose() {
      if (disposed) return
      stopName()
      // Unbinding writes an edit still waiting to be sent, so it runs while the room is open.
      unbindGraphEvents()
      variableSync.dispose()
      documentSync.dispose()
      roomImages?.dispose()
      disposed = true
      meta.unobserve(refreshDocument)
      unregisterYjsObservers()
      saves.dispose()
      // Destroying the awareness can emit a last change; nothing here should react to it.
      awareness.off('change', presenceChanged)
      changeHandlers.clear()
      presenceHandlers.clear()
      void connection.room.leave()
      awareness.destroy()
      void persistence.destroy()
      ydoc.destroy()
    }
  }
}
