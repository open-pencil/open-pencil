import type { CloudAPIClient } from '@open-pencil/cloud/client'

import { connectCloudProfile, OFFICIAL_OPENPENCIL_CLOUD_URL } from '@/app/cloud/instances/profiles'
import { normalizeCloudServerURL } from '@/app/cloud/sessions/connection'
import type { StorageDocument, StorageDocumentBinding } from '@/app/integrations/storage/types'

/** Resolve an explicitly granted document without changing the selected location. */
export async function resolveInvitedCloudDocument(
  serverURL: string,
  documentId: string,
  client: Pick<CloudAPIClient, 'getDocument'>
): Promise<{ document: StorageDocument; binding: StorageDocumentBinding }> {
  const server = normalizeCloudServerURL(serverURL)
  const { document } = await client.getDocument(documentId)
  const profile = await connectCloudProfile({
    kind: server === OFFICIAL_OPENPENCIL_CLOUD_URL ? 'official' : 'self-hosted',
    serverURL: server,
    activate: false
  })
  return {
    document: {
      id: document.id,
      name: document.name,
      updatedAt: document.updatedAt,
      remoteRevisionId: document.currentRevisionId,
      metadataAuthoritative: true
    },
    binding: {
      providerId: 'openpencil-cloud',
      connectionId: profile.id,
      workspaceId: document.workspaceId,
      documentId: document.id
    }
  }
}
