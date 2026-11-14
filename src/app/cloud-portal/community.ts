import { shallowRef } from 'vue'

import { createCloudAPIClient } from '@open-pencil/cloud/client'
import {
  cloudCommunityDesktopLinkURL,
  cloudCommunityURL,
  type CloudDiscovery,
  type CommunityDocument
} from '@open-pencil/cloud/contract'

/** The gallery's documents as a page reads them: loading, read, or failed with a message. */
export type CommunityListState =
  | { status: 'loading' }
  | { status: 'ready'; documents: CommunityDocument[] }
  | { status: 'failed'; error: string }

/** Reads the server's community gallery for a page, and again on `reload`. */
export function useCommunityDocuments(discovery: CloudDiscovery) {
  const client = createCloudAPIClient(discovery.apiURL)
  const state = shallowRef<CommunityListState>({ status: 'loading' })
  async function reload() {
    state.value = { status: 'loading' }
    try {
      const { documents } = await client.listCommunityDocuments()
      state.value = { status: 'ready', documents }
    } catch (error) {
      state.value = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  void reload()
  return { state, reload }
}

/** A community document on this server, as it is now (`versionId` null) or as a named version. */
export type CommunityTarget = { documentId: string; versionId: string | null }

type PageLocation = Pick<Location, 'assign' | 'origin'>

/** Opens a community document read-only in this server's editor in the browser. */
export function openCommunityInBrowser(
  { documentId, versionId }: CommunityTarget,
  location: PageLocation = globalThis.location
): void {
  location.assign(cloudCommunityURL(location.origin, documentId, versionId))
}

/**
 * Hands a community document to the desktop app, which opens it read-only; the browser asks
 * before it opens the app, as for shared links (`openCloudLinkInDesktop`).
 */
export function openCommunityInDesktop(
  { documentId, versionId }: CommunityTarget,
  location: PageLocation = globalThis.location
): void {
  location.assign(cloudCommunityDesktopLinkURL(documentId, location.origin, versionId))
}
