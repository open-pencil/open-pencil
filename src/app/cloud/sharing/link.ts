import { useLocalStorage } from '@vueuse/core'
import { ref, shallowRef, watch } from 'vue'

import { CloudAPIError, createCloudAPIClient } from '@open-pencil/cloud/client'
import { randomHex } from '@open-pencil/scene-graph/random'

import { useCollabIdentity } from '@/app/collab/identity'
import type { EditorStore } from '@/app/editor/session'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import { allTabs, closeTab, getTabForStore, openFileInNewTab } from '@/app/tabs'
import { IS_BROWSER } from '@/constants'

import { sharedCloudRoomImages } from '../rooms/images'
import {
  cloudRelayTransport,
  leaveRefusedRoom,
  openCloudDocumentRoom,
  stopWithTab
} from '../rooms/live'
import { normalizeCloudServerURL } from '../servers/address'
import { cloudServers } from '../servers/store'
import { cloudFetch, cloudServerFetch, discoverCloudServer } from '../sessions/connection'

/** Who this browser is to rooms it joins from links, kept so a guest stays the same person. */
const guestId = IS_BROWSER
  ? useLocalStorage('open-pencil:cloud-guest-id', randomHex(16))
  : ref(randomHex(16))

export type CloudShareLink = { shareId: string; server: string; secret: string }

/** A tab a guest views from a link, and whether signing in would let them edit it. */
export type CloudGuestLinkTab = { link: CloudShareLink; canEditSignedIn: boolean }

/** Tabs viewing a link without an account, for the status beside the name. */
export const cloudGuestLinkTabs = shallowRef<ReadonlyMap<EditorStore, CloudGuestLinkTab>>(new Map())

function setGuestLinkTab(store: EditorStore, tab: CloudGuestLinkTab | null): void {
  const next = new Map(cloudGuestLinkTabs.value)
  if (tab) {
    if (!next.has(store)) {
      const stopWatching = watch(allTabs, () => {
        if (getTabForStore(store)) return
        stopWatching()
        setGuestLinkTab(store, null)
      })
    }
    next.set(store, tab)
  } else next.delete(store)
  cloudGuestLinkTabs.value = next
}

/**
 * Closes the guest tabs of a link once it opened again with an account, so the signed-in tab
 * replaces the view-only one. They never save, so nothing is lost.
 */
async function closeGuestTabsOf(shareId: string, except: EditorStore): Promise<void> {
  for (const [store, tab] of cloudGuestLinkTabs.value) {
    const open = getTabForStore(store)
    if (store === except || tab.link.shareId !== shareId || !open) continue
    setGuestLinkTab(store, null)
    await closeTab(open.id, 'discard')
  }
}

/**
 * Opens a document someone shared by link: its latest revision in a tab of its own, then its
 * room with the link's permission. The tab is a copy that never saves to the server; edits reach
 * the document through the room. Requests carry this app's session with the server when it has
 * one, since a server may let only people signed in to it follow links. Returns `sign-in` when
 * the server asks for that.
 */
export async function openCloudShareLink(link: CloudShareLink): Promise<'opened' | 'sign-in'> {
  const url = normalizeCloudServerURL(link.server)
  if (!url) throw new TypeError('The link names no server')
  const discovery = await discoverCloudServer(url)
  const server = cloudServers.value.find((candidate) => candidate.url === url)
  const client = createCloudAPIClient(discovery.apiURL, {
    fetch: server ? cloudServerFetch(server.id) : cloudFetch
  })
  const input = {
    secret: link.secret,
    guestName: useCollabIdentity().name.value,
    guestId: guestId.value
  }
  let shared: Awaited<ReturnType<typeof client.getSharedDocument>>
  try {
    shared = await client.getSharedDocument(link.shareId, input)
  } catch (error) {
    if (error instanceof CloudAPIError && error.status === 401) return 'sign-in'
    throw error
  }
  const { document, resolution } = shared
  const bytes = await downloadCloudDocument(document, (input, init) => storageFetch(input, init))
  const name = document.document.name
  const store = await openFileInNewTab(
    new File([Uint8Array.from(bytes)], `${name}.fig`, { type: 'application/octet-stream' })
  )
  if (resolution.principal.kind === 'user') await closeGuestTabsOf(link.shareId, store)
  else if (resolution.permission === 'view') {
    setGuestLinkTab(store, { link, canEditSignedIn: resolution.linkPermission === 'edit' })
  }
  // A viewer without a room never hears the room make the tab read-only.
  if (resolution.permission === 'view') store.setReadOnly(true)
  if (!discovery.capabilities.collaboration) return 'opened'
  const first = await client.getSharedCollaborationTicket(link.shareId, input)
  // The tab may have closed while the ticket was on its way.
  if (first.provider !== 'relay' || !first.serverURL || !getTabForStore(store)) return 'opened'
  const room = openCloudDocumentRoom(store, {
    roomId: first.roomId,
    transport: cloudRelayTransport(
      first.serverURL,
      first,
      () => client.getSharedCollaborationTicket(link.shareId, input),
      // A guest has no account to save with, so leaving is all a refusal changes.
      { onRefused: () => leaveRefusedRoom(store, { permission: first.permission, canSave: false }) }
    ),
    permission: first.permission,
    guest: true,
    images: sharedCloudRoomImages(client, link.shareId, input)
  })
  stopWithTab(store, room)
  return 'opened'
}
