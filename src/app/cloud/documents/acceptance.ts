import type { CloudAPIClient } from '@open-pencil/cloud/client'

import { resolveInvitedCloudDocument } from './invitations'

type InvitationClient = Pick<CloudAPIClient, 'acceptDocumentInvitation' | 'getDocument'>

/** Once accepted, retries use the granted document rather than consuming the invitation again. */
export function createInvitationAcceptance(serverURL: string, invitationId: string, token: string) {
  let documentId: string | null = null
  let pending: ReturnType<typeof resolveInvitedCloudDocument> | null = null
  async function resolve(client: InvitationClient) {
    if (!documentId) {
      const grant = await client.acceptDocumentInvitation(invitationId, { token })
      documentId = grant.documentId
    }
    return resolveInvitedCloudDocument(serverURL, documentId, client)
  }
  return {
    get accepted() {
      return documentId !== null
    },
    open(client: InvitationClient) {
      if (pending) return pending
      const request = resolve(client).finally(() => {
        if (pending === request) pending = null
      })
      pending = request
      return request
    }
  }
}
