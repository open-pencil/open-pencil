import { watch } from 'vue'

import { messageStores } from '@open-pencil/vue/i18n'

import type { EditorStore } from '@/app/editor/session'
import { notify } from '@/app/shell/notifications'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { getTabForStore, getTabsSnapshot, switchTab } from '@/app/tabs'

import { cloudRoomPermissions, cloudRoomsAtStorageLimit } from '../rooms/live'
import { requestConflictChoice } from './conflict'
import { isCloudBinding } from './status'

/** Where a tab's room access leaves it: editing, viewing, or viewing because storage is full. */
type RoomAccess = 'edit' | 'view' | 'storage-limit'

/**
 * Whether a Cloud tab's access means its edits stopped: it could edit, and now views because its
 * owner's storage is full. A tab that opened at the limit was never editing, so it says nothing.
 */
function lostEditingToStorageLimit(before: RoomAccess | undefined, after: RoomAccess): boolean {
  return before === 'edit' && after === 'storage-limit'
}

function notifyStorageFull(store: EditorStore): void {
  const tabId = getTabForStore(store)?.id
  if (!tabId) return
  const messages = messageStores['cloud/editor'].get()
  notify({
    event: 'cloudStorageFull',
    title: messages.storageFullTitle({ name: store.state.documentName }),
    body: messages.statusStorageFullDetail,
    tabId,
    tag: `storage-full:${tabId}`,
    open: () => void switchTab(tabId)
  })
}

function notifyConflict(store: EditorStore, documentId: string): void {
  const tabId = getTabForStore(store)?.id
  if (!tabId) return
  const messages = messageStores['cloud/editor'].get()
  notify({
    event: 'cloudConflict',
    title: messages.changedInTwoPlaces({ name: store.state.documentName }),
    body: messages.conflictDescription,
    tabId,
    tag: `conflict:${tabId}`,
    open: () => {
      if (!switchTab(tabId)) return
      // Keeping both moves the tab to the copy, which is not the document this was about.
      if (store.getStorageBinding()?.documentId === documentId) requestConflictChoice(store)
    }
  })
}

/**
 * The open Cloud tab of `documentId` whose conflict waits for the person; a tab in a live room has
 * its conflicts settled by the room's saver, so it has none to choose.
 */
function tabWaitingOnConflict(documentId: string): EditorStore | null {
  const tab = getTabsSnapshot().find((candidate) => {
    const binding = candidate.store.getStorageBinding()
    return (
      candidate.kind === 'document' &&
      !cloudRoomPermissions.value.has(candidate.store) &&
      isCloudBinding(binding) &&
      binding?.documentId === documentId
    )
  })
  return tab?.store ?? null
}

/**
 * Notifies, while the person is away, when an open Cloud document needs them: it was changed in two
 * places and waits for a choice, or its owner's storage filled and it can no longer be edited. Each
 * says so once, until the document leaves that state. Returns what stops watching.
 */
export function watchCloudDocumentNotices(): () => void {
  const access = new WeakMap<EditorStore, RoomAccess>()
  const stopAccess = watch([cloudRoomPermissions, cloudRoomsAtStorageLimit], ([permissions]) => {
    for (const [store, permission] of permissions) {
      const next = cloudRoomsAtStorageLimit.value.has(store) ? 'storage-limit' : permission
      if (lostEditingToStorageLimit(access.get(store), next)) notifyStorageFull(store)
      access.set(store, next)
    }
  })

  const conflicted = new Set<string>()
  let stopped = false
  async function checkConflict(documentId: string) {
    const meta = await getLocalCanvasStore().getMeta(documentId)
    if (stopped) return
    if (meta?.syncStatus !== 'conflict') {
      conflicted.delete(documentId)
      return
    }
    const store = tabWaitingOnConflict(documentId)
    if (!store || conflicted.has(documentId)) return
    conflicted.add(documentId)
    notifyConflict(store, documentId)
  }
  const stopConflicts = onStorageWorkspaceEvent(({ documentId }) => {
    if (documentId) void checkConflict(documentId).catch(() => undefined)
  })

  return () => {
    stopped = true
    stopAccess()
    stopConflicts()
  }
}
