import { shallowRef, watch } from 'vue'

import { RELAY_SERVER_PEER, type CollaborationTicket } from '@open-pencil/cloud/contract'

import { openDocumentRoom, roomForStore } from '@/app/collab/rooms'
import type { RoomSession } from '@/app/collab/session'
import type { JoinCollabRoom } from '@/app/collab/transport'
import { createCloudRelayJoin } from '@/app/collab/transport/cloud'
import type { EditorStore } from '@/app/editor/session'
import { createStorageAdapter } from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { dropCanvasUploads, kickSyncEngine, replaceStoredVersion } from '@/app/storage/sync'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { allTabs, getTabsSnapshot } from '@/app/tabs'

import { isCloudBinding } from '../documents/status'
import { cloudConnections } from '../sessions/connection'
import { cloudShareTarget } from '../sharing/document'

/** Each Cloud tab's permission in its room, for the status beside the name. */
export const cloudRoomPermissions = shallowRef<ReadonlyMap<EditorStore, 'edit' | 'view'>>(new Map())
const starting = new WeakSet<EditorStore>()

function setPermission(store: EditorStore, permission: 'edit' | 'view' | null) {
  const next = new Map(cloudRoomPermissions.value)
  if (permission) next.set(store, permission)
  else next.delete(store)
  cloudRoomPermissions.value = next
}

/**
 * The editor that saves the room's document: the one with the lowest presence client among
 * those who may edit. Everyone else sees edits through the room, so nobody's revision conflicts
 * with anyone else's.
 */
export function electCloudSaver(
  presence: ReadonlyMap<number, Record<string, unknown>>,
  self: { clientId: number; canEdit: boolean }
): number | null {
  const editors = [...presence]
    .filter(([clientId, state]) => {
      if (clientId === self.clientId) return self.canEdit
      const cloud = state.cloud
      return (
        typeof cloud === 'object' && cloud !== null && Reflect.get(cloud, 'permission') === 'edit'
      )
    })
    .map(([clientId]) => clientId)
  return editors.length ? Math.min(...editors) : null
}

/** Building on the server's latest revision: the room already holds every edit in it. */
async function catchUpWithServer(store: EditorStore): Promise<void> {
  const binding = store.getStorageBinding()
  if (!binding) return
  const documents = await createStorageAdapter(binding).listDocuments()
  const current = documents.find((document) => document.id === binding.documentId)
  if (current?.revision) {
    await getLocalCanvasStore().updateMeta(binding.documentId, { remoteRevision: current.revision })
  }
}

/**
 * Keeps this tab saving only while it is the room's saver. A tab that stops drops its queued
 * uploads, since the room holds those edits; the saver overwrites a revision it conflicts with,
 * since the room's document already has every edit in it.
 */
function followSaver(store: EditorStore, session: RoomSession, canEdit: boolean): () => void {
  let saving: boolean | null = null
  const documentId = () => store.getStorageBinding()?.documentId ?? null

  async function decide() {
    const saver = electCloudSaver(session.presence(), { clientId: session.clientId, canEdit })
    const next = saver === session.clientId
    if (next === saving) return
    saving = next
    store.state.autosaveEnabled = next
    const id = documentId()
    if (!id) return
    if (!next) {
      await dropCanvasUploads(id)
      return
    }
    await catchUpWithServer(store).catch(() => undefined)
    // Only a stored document saves without asking where; the room never adds a file prompt.
    if (store.getStorageBinding() && store.hasUnsavedChanges()) await store.saveFigFile()
  }

  async function settleConflict(id: string) {
    if (!saving) return
    const meta = await getLocalCanvasStore().getMeta(id)
    if (meta?.syncStatus !== 'conflict') return
    await replaceStoredVersion(id)
    await kickSyncEngine()
  }

  const stopPeers = watch(session.peers, () => void decide(), { immediate: true })
  // Edits in a tab that does not save are kept by the room and uploaded by the saver, so the
  // tab neither calls them unsaved nor asks about them on closing.
  const stopDirty = watch(
    () => store.hasUnsavedChanges(),
    (dirty) => {
      if (dirty && saving === false) store.markDocumentSaved()
    }
  )
  const stopEvents = onStorageWorkspaceEvent((event) => {
    const id = documentId()
    if (id && event.documentId === id) void settleConflict(id)
  })
  return () => {
    stopPeers()
    stopDirty()
    stopEvents()
  }
}

/**
 * Puts a stored document's tab into its room: an empty room takes this tab's document once the
 * relay has answered, one editor saves for everyone, and a viewer never saves.
 */
export function openCloudDocumentRoom(
  store: EditorStore,
  options: { roomId: string; transport: JoinCollabRoom; permission: 'edit' | 'view' }
) {
  const canEdit = options.permission === 'edit'
  const session = openDocumentRoom(store, options.roomId, options.transport)
  setPermission(store, options.permission)
  if (!canEdit) store.state.autosaveEnabled = false
  const stopSynced = session.onSynced((peerId) => {
    if (peerId !== RELAY_SERVER_PEER) return
    stopSynced()
    if (canEdit && !session.roomHasDocument()) session.shareDocument()
  })
  const stopSaver = followSaver(store, session, canEdit)
  return {
    session,
    stop() {
      stopSynced()
      stopSaver()
      setPermission(store, null)
    }
  }
}

/**
 * Joins a Cloud document's room on its server's relay, when the server runs one. Edits reach
 * everyone in the room as they happen; an empty room takes this tab's document once the relay
 * has answered; viewers' edits never leave the tab.
 */
export async function startCloudRoom(store: EditorStore): Promise<void> {
  const binding = store.getStorageBinding()
  if (!binding || !isCloudBinding(binding) || roomForStore(store) || starting.has(store)) return
  const target = cloudShareTarget(binding)
  if (!target?.discovery.capabilities.collaboration) return
  starting.add(store)
  try {
    const first = await target.client.getCollaborationTicket(binding.documentId)
    if (first.provider !== 'relay' || !first.serverURL || store.getStorageBinding() !== binding) {
      return
    }
    // The first ticket is the one just issued; later ones refresh before each expires.
    let unused: CollaborationTicket | null = first
    const transport = createCloudRelayJoin({
      url: first.serverURL,
      async ticket() {
        const next = unused ?? (await target.client.getCollaborationTicket(binding.documentId))
        unused = null
        return { token: next.token, expiresAt: next.expiresAt }
      }
    })
    const room = openCloudDocumentRoom(store, {
      roomId: first.roomId,
      transport,
      permission: first.permission
    })
    const stopLeaving = watch(allTabs, () => {
      if (roomForStore(store)) return
      room.stop()
      stopLeaving()
    })
  } finally {
    starting.delete(store)
  }
}

/** Starts the room of every open Cloud document, as tabs open and documents move to Cloud. */
export function watchCloudRooms(): () => void {
  return watch(
    () => {
      // Tabs, their bindings, and sign-ins are reactive; the snapshot carries the stores.
      void allTabs.value
      void cloudConnections.value
      return getTabsSnapshot().map((tab) => [tab.store, tab.store.getStorageBinding()] as const)
    },
    (entries) => {
      for (const [store] of entries) void startCloudRoom(store).catch(() => undefined)
    },
    { immediate: true }
  )
}
