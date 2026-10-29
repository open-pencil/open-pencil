import { isEqual, omit } from 'es-toolkit'
import { watch } from 'vue'
import type { LocationQuery, RouteLocationNormalizedLoaded, Router } from 'vue-router'

import { cloudDocumentAddress, openingCloudLink } from '@/app/cloud/integration'
import { isRoomId } from '@/app/collab/room/id'
import { activeRoom } from '@/app/collab/rooms'

import { activeTab } from './index'

export const ROOM_ROUTE_PREFIX = '/rooms/'
const CLOUD_DOCUMENT_PREFIX = '/documents/'
/** The query a Cloud document's address adds, and leaving it takes away. */
const CLOUD_DOCUMENT_QUERY = ['version']

export type TabAddress = { path: string; query: LocationQuery }

export function roomRoutePath(roomId: string): string {
  return `${ROOM_ROUTE_PREFIX}${roomId}`
}

/**
 * The address for the active tab: its Cloud document's, its room's link, or `/` after
 * leaving either. A Cloud document's room is the server's relay channel, so its ID never goes in
 * the address. On `opening`, a document address stays for startup to open.
 */
export function tabAddressFor(
  roomId: string | null,
  cloud: { path: string; query: Record<string, string> } | null,
  current: TabAddress,
  opening = false
): TabAddress {
  const query = omit(current.query, CLOUD_DOCUMENT_QUERY)
  if (cloud) return { path: cloud.path, query: { ...query, ...cloud.query } }
  if (roomId && isRoomId(roomId)) return { path: roomRoutePath(roomId), query }
  if (current.path.startsWith(ROOM_ROUTE_PREFIX)) return { path: '/', query }
  if (current.path.startsWith(CLOUD_DOCUMENT_PREFIX) && !opening) return { path: '/', query }
  return current
}

/**
 * Keeps the address bar on the active tab: its Cloud document, with the version it shows, or its
 * shared room, and back to `/` for anything else, so a reload or a copied URL opens what is on
 * screen.
 */
export function syncTabAddress(router: Router, route: RouteLocationNormalizedLoaded): () => void {
  let first = true
  return watch(
    () => {
      const store = activeTab.value?.store
      return [
        activeRoom.value?.roomId ?? null,
        store ? cloudDocumentAddress(store) : null,
        openingCloudLink.value
      ] as const
    },
    ([roomId, cloud, opening]) => {
      const current = { path: route.path, query: route.query }
      // Until the link the tab started with has opened, its address stays, for a reload too.
      const next = tabAddressFor(roomId, cloud, current, first || opening)
      first = false
      if (next.path === current.path && isEqual(next.query, current.query)) return
      void router.replace({ ...next, hash: route.hash })
    },
    { immediate: true }
  )
}
