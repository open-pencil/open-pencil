import { useLocalStorage } from '@vueuse/core'
import { ref, shallowRef, watch } from 'vue'

import { CloudAPIError, createCloudAPIClient } from '@open-pencil/cloud/client'
import { randomHex } from '@open-pencil/scene-graph/random'

import { useCollabIdentity } from '@/app/collab/identity'
import type { EditorStore } from '@/app/editor/session'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import {
  allTabs,
  closeTab,
  getTabForStore,
  onTabDocumentReplaced,
  openFileInNewTab
} from '@/app/tabs'
import { IS_BROWSER } from '@/constants'

import { rememberShareLinkTab } from '../reports/tabs'
import { sharedCloudRoomImages } from '../rooms/images'
import {
  cloudRelayTransport,
  leaveCloudRoom,
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

/** The API client for a link's server, carrying this app's session with it when there is one. */
export async function shareLinkClient(link: CloudShareLink) {
  const url = normalizeCloudServerURL(link.server)
  if (!url) throw new TypeError('The link names no server')
  const discovery = await discoverCloudServer(url)
  const server = cloudServers.value.find((candidate) => candidate.url === url)
  const client = createCloudAPIClient(discovery.apiURL, {
    fetch: server ? cloudServerFetch(server.id) : cloudFetch
  })
  return { client, discovery, serverId: server?.id ?? null }
}

/** Who this browser is to a link's server as a guest. */
export function cloudGuestId(): string {
  return guestId.value
}

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

// A tab that opens another file no longer shows the link's document.
onTabDocumentReplaced((store) => {
  if (cloudGuestLinkTabs.value.has(store)) setGuestLinkTab(store, null)
})

/**
 * Closes the guest tabs of a link once it opened again with an account, so the signed-in tab
 * replaces the view-only one. They never save, so nothing is lost.
 */
async function closeGuestTabsOf(shareId: string, except: EditorStore): Promise<void> {
  // The signed-in copy may have opened in the guest's own tab, which stays, now signed in.
  setGuestLinkTab(except, null)
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
  const { client, discovery } = await shareLinkClient(link)
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
  rememberShareLinkTab(store, link)
  // The copy may open in a reused tab still in this link's room as a guest, whose ticket would
  // hold it to the guest's permission; it joins again below with this one's.
  leaveCloudRoom(store)
  if (resolution.principal.kind === 'user') await closeGuestTabsOf(link.shareId, store)
  else if (resolution.permission === 'view') {
    setGuestLinkTab(store, { link, canEditSignedIn: resolution.linkPermission === 'edit' })
  }
  // Without a room nothing else sets the permission, and a reused tab may have been view-only.
  store.setReadOnly(resolution.permission === 'view')
  if (!discovery.capabilities.collaboration) return 'opened'
  await joinShareRoom(store, link, client, input)
  return 'opened'
}

/**
 * Puts a link's tab into the document's room with the access its ticket grants. The tab joins
 * again when that access changes, as when the owner fills or frees their storage, or when the
 * document is restored to a version and moves to a new room.
 */
async function joinShareRoom(
  store: EditorStore,
  link: CloudShareLink,
  client: Awaited<ReturnType<typeof shareLinkClient>>['client'],
  input: { secret: string; guestName: string; guestId: string }
): Promise<void> {
  const first = await client.getSharedCollaborationTicket(link.shareId, input)
  // The tab may have closed while the ticket was on its way.
  if (first.provider !== 'relay' || !first.serverURL || !getTabForStore(store)) return
  const room = openCloudDocumentRoom(store, {
    roomId: first.roomId,
    transport: cloudRelayTransport(
      first.serverURL,
      first,
      () => client.getSharedCollaborationTicket(link.shareId, input),
      {
        onRestored: () => {
          room.stop()
          void joinShareRoom(store, link, client, input)
        },
        // A guest has no account to save with, so leaving is all a refusal changes.
        onRefused: () => leaveRefusedRoom(store, { permission: first.permission, canSave: false })
      }
    ),
    permission: first.permission,
    readOnly: first.readOnly,
    guest: true,
    images: sharedCloudRoomImages(client, link.shareId, input)
  })
  stopWithTab(store, room)
}
