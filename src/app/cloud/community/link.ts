import { createCloudAPIClient } from '@open-pencil/cloud/client'
import { cloudCommunityPath, parseCloudLinkPath } from '@open-pencil/cloud/contract'
import { cloudMessages } from '@open-pencil/vue/i18n'

import type { EditorStore } from '@/app/editor/session'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import { toast } from '@/app/shell/ui'
import { onTabDocumentReplaced, openFileInNewTab } from '@/app/tabs'

import { normalizeCloudServerURL } from '../servers/address'
import { cloudFetch, discoverCloudServer } from '../sessions/connection'

/**
 * A document of a server's community gallery, `/community/:id` on that server, with `?version=…`
 * for one of its named versions. Anyone opens it, without signing in or a secret.
 */
export type CloudCommunityLink = { documentId: string; server: string; versionId: string | null }

/** Tabs showing a gallery document, by the link they opened. */
const communityTabs = new WeakMap<EditorStore, CloudCommunityLink>()

// A tab that opens another file no longer shows the gallery document.
onTabDocumentReplaced((store) => communityTabs.delete(store))

/**
 * The address of the gallery document in `store`, for the address bar: null for any other tab,
 * and for a document of any server but the one serving this editor, whose address could not name
 * it.
 */
export function cloudCommunityAddress(
  store: EditorStore
): { path: string; query: Record<string, string> } | null {
  const link = communityTabs.get(store)
  if (!link || new URL(link.server).origin !== globalThis.location.origin) return null
  return {
    path: cloudCommunityPath(link.documentId),
    query: link.versionId ? { version: link.versionId } : {}
  }
}

/** The gallery link a web address carries, if it is one; its server is the address's own. */
export function readCloudCommunityLink(url: URL): CloudCommunityLink | null {
  const path = parseCloudLinkPath(url.pathname)
  if (path?.kind !== 'community') return null
  return { documentId: path.id, server: url.origin, versionId: url.searchParams.get('version') }
}

/**
 * Opens a gallery document read-only in a tab of its own: the file as it is now, or the named
 * version the link asks for, with its images. The tab is a copy that never saves anywhere, and
 * it does not join the document's room, so it shows the document as published.
 */
export async function openCloudCommunityLink(link: CloudCommunityLink): Promise<void> {
  try {
    const url = normalizeCloudServerURL(link.server)
    if (!url) throw new TypeError('The link names no server')
    const discovery = await discoverCloudServer(url)
    const client = createCloudAPIClient(discovery.apiURL, { fetch: cloudFetch })
    const { document } = await client.getCommunityDocument(link.documentId, link.versionId)
    const bytes = await downloadCloudDocument(document, (input, init) => storageFetch(input, init))
    const store = await openFileInNewTab(
      new File([Uint8Array.from(bytes)], `${document.document.name}.fig`, {
        type: 'application/octet-stream'
      })
    )
    store.setReadOnly(true)
    communityTabs.set(store, link)
  } catch (error) {
    console.warn('[Cloud] Opening the community document failed:', error)
    toast.error(cloudMessages.get().communityLinkFailed)
  }
}
