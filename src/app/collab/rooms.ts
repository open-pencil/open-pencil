import { computed, shallowRef, watch } from 'vue'

import { generateRoomId } from '@/app/collab/awareness'
import { isRoomId } from '@/app/collab/room/id'
import { openRoomSession, type RoomSession } from '@/app/collab/session'
import type { JoinCollabRoom } from '@/app/collab/transport'
import type { EditorStore } from '@/app/editor/active-store'
import { activeTab, allTabs, closeTab, createTab, getTabForStore, switchTab } from '@/app/tabs'

/**
 * Rooms by tab. A room is a document: joining opens it in a tab of its own, and only Share
 * puts an existing tab's document into a room. Every room tab keeps its own session, so several
 * rooms can be live at once and keep syncing in the background.
 */
const sessions = shallowRef<readonly RoomSession[]>([])

/** Tabs that left a room they joined and kept its document as a local copy. */
const leftRooms = shallowRef<readonly EditorStore[]>([])

export const activeRoom = computed(() => {
  const store = activeTab.value?.store
  return store ? roomForStore(store) : undefined
})

export const activeTabLeftRoom = computed(() => {
  const store = activeTab.value?.store
  return store ? leftRooms.value.includes(store) : false
})

export function roomForStore(store: EditorStore): RoomSession | undefined {
  return sessions.value.find((session) => session.store === store)
}

export function roomById(roomId: string): RoomSession | undefined {
  return sessions.value.find((session) => session.roomId === roomId)
}

function addSession(session: RoomSession) {
  sessions.value = [...sessions.value, session]
  leftRooms.value = leftRooms.value.filter((store) => store !== session.store)
}

function removeSession(session: RoomSession) {
  session.dispose()
  sessions.value = sessions.value.filter((candidate) => candidate !== session)
}

/** Puts a tab's document into a new room, or returns the room it is already in. */
export function shareDocument(store: EditorStore, roomId = generateRoomId()): RoomSession {
  const existing = roomForStore(store)
  if (existing) return existing
  const session = openRoomSession({ roomId, store, origin: 'shared' })
  addSession(session)
  session.shareDocument()
  return session
}

export interface JoinRoomOptions {
  /** What the new tab is called until the room's document brings its own name. */
  tabName: string
  transport?: JoinCollabRoom
}

/**
 * Opens a room in a tab of its own, or switches to the tab already showing it. Null when the
 * ID is not a room ID. The new tab shows the joining screen until the room's document arrives.
 */
export function joinRoom(
  roomId: string,
  { tabName, transport }: JoinRoomOptions
): RoomSession | null {
  if (!isRoomId(roomId)) return null
  const existing = roomById(roomId)
  if (existing) {
    const tab = getTabForStore(existing.store)
    if (tab) switchTab(tab.id)
    return existing
  }
  const tab = createTab()
  tab.store.state.documentName = tabName
  const session = openRoomSession({
    roomId,
    store: tab.store,
    origin: 'joined',
    joinRoom: transport
  })
  addSession(session)
  return session
}

/**
 * Leaves a room. A tab that shared its document goes back to being that document. A tab that
 * joined keeps the room's document as a local unsaved copy, or closes when nothing arrived.
 */
export function leaveRoom(session: RoomSession): void {
  removeSession(session)
  if (session.origin === 'shared') return
  const tab = getTabForStore(session.store)
  if (!tab) return
  if (session.hasDocument.value) {
    leftRooms.value = [...leftRooms.value, session.store]
    return
  }
  void closeTab(tab.id, 'discard')
}

export function dismissLeftRoomNote(store: EditorStore): void {
  leftRooms.value = leftRooms.value.filter((candidate) => candidate !== store)
}

// A closed tab takes its room with it.
watch(allTabs, () => {
  for (const session of sessions.value) {
    if (!getTabForStore(session.store)) removeSession(session)
  }
  leftRooms.value = leftRooms.value.filter((store) => getTabForStore(store) !== undefined)
})
