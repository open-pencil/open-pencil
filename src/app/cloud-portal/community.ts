import { shallowRef } from 'vue'

import { createCloudAPIClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery, CommunityDocument } from '@open-pencil/cloud/contract'

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

/**
 * Who the gallery's files are from: the official server's are OpenPencil's own, and any other
 * server's are its operator's, named by its address.
 */
export function communityPublisher(discovery: CloudDiscovery, host: string): string {
  return discovery.deployment === 'official' ? 'OpenPencil' : host
}
