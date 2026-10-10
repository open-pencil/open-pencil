import { cloudShareURL, type CloudAPIClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery, DocumentPermission, DocumentShare } from '@open-pencil/cloud/contract'

import type { StorageDocumentBinding } from '@/app/integrations/storage/types'

import { findCloudServer, type CloudServer } from '../servers/store'
import { cloudAPIClient, cloudConnection } from '../sessions/connection'
import { clearShareSecret, readShareSecret, saveShareSecret } from './secrets'

/** Someone with access: a person granted it, or an invitation not accepted yet. */
export type CloudShareMember = {
  id: string
  name: string
  email: string
  permission: DocumentPermission
  /** When a pending invitation expires. */
  pendingUntil?: string
  you?: boolean
}

export type CloudShareLink =
  | { access: 'restricted' }
  | { access: 'link'; permission: DocumentPermission; copyable: boolean }

export type CloudSharing = {
  canManage: boolean
  members: CloudShareMember[]
  link: CloudShareLink
  /** What the workspace's plan allows for links. */
  links: { allowed: boolean; edit: boolean }
}

type Target = {
  server: CloudServer
  discovery: CloudDiscovery
  client: CloudAPIClient
  documentId: string
  workspaceId: string | null
  accountId: string | null
}

const GRANT = 'grant:'
const INVITATION = 'invitation:'

/** The server, client, and document for a Cloud binding, while signed in to its server. */
export function cloudShareTarget(binding: StorageDocumentBinding): Target | null {
  const server = binding.profileId ? findCloudServer(binding.profileId) : null
  if (!server) return null
  const connection = cloudConnection(server.id)
  if (connection.state !== 'signed-in' || !connection.discovery) return null
  return {
    server,
    discovery: connection.discovery,
    client: cloudAPIClient(server, connection.discovery),
    documentId: binding.documentId,
    workspaceId: binding.containerId ?? null,
    accountId: connection.account?.id ?? null
  }
}

const activeShare = (shares: DocumentShare[]) => shares.find((share) => !share.revokedAt) ?? null

/** Who can open the document and whether its link is on, as this account may see it. */
export async function readCloudSharing(target: Target): Promise<CloudSharing> {
  const { client, documentId } = target
  const access = await client.getDocumentAccess(documentId)
  const closed = { allowed: false, edit: false }
  if (!access.canManageSharing) {
    return { canManage: false, members: [], link: { access: 'restricted' }, links: closed }
  }
  const [grants, invitations, shares, entitlements] = await Promise.all([
    client.listDocumentGrants(documentId),
    client.listDocumentInvitations(documentId),
    client.listDocumentShares(documentId),
    target.workspaceId
      ? client.getWorkspaceEntitlements(target.workspaceId).catch(() => null)
      : Promise.resolve(null)
  ])
  const features = entitlements?.features
  // Links open the document without an account, so they need anonymous access as well.
  const links = features
    ? { allowed: features.capabilityLinks && features.anonymousView, edit: features.anonymousEdit }
    : closed
  const people = await Promise.all(
    grants.map(async (grant) => {
      const profile = await client.getUserProfile(documentId, grant.userId).catch(() => null)
      return {
        id: `${GRANT}${grant.userId}`,
        name: profile?.name ?? grant.userId,
        email: profile?.email ?? '',
        permission: grant.permission,
        you: grant.userId === target.accountId
      }
    })
  )
  const pending = invitations
    .filter((invitation) => !invitation.acceptedAt)
    .map((invitation) => ({
      id: `${INVITATION}${invitation.id}`,
      name: invitation.email,
      email: invitation.email,
      permission: invitation.permission,
      pendingUntil: invitation.expiresAt
    }))
  const share = activeShare(shares)
  const link: CloudShareLink = share
    ? {
        access: 'link',
        permission: share.permission,
        copyable: Boolean(await readShareSecret(target.server.id, share.id))
      }
    : { access: 'restricted' }
  return { canManage: true, members: [...people, ...pending], link, links }
}

export async function inviteToCloudDocument(
  target: Target,
  email: string,
  permission: DocumentPermission
): Promise<void> {
  await target.client.createDocumentInvitation(target.documentId, { email, permission })
}

/** Changes or removes a person's access, or withdraws an invitation. */
export async function changeCloudMember(
  target: Target,
  memberId: string,
  change: DocumentPermission | 'remove'
): Promise<void> {
  const { client, documentId } = target
  if (memberId.startsWith(INVITATION)) {
    const invitationId = memberId.slice(INVITATION.length)
    if (change === 'remove') await client.revokeDocumentInvitation(documentId, invitationId)
    return
  }
  const userId = memberId.slice(GRANT.length)
  if (change === 'remove') await client.revokeDocumentGrant(documentId, userId)
  else await client.putDocumentGrant(documentId, userId, { permission: change })
}

/**
 * Turns the link off, on with a permission, or changes its permission. A new link's secret is
 * kept on this device so the link can be copied here.
 */
export async function changeCloudLink(target: Target, link: CloudShareLink): Promise<void> {
  const { client, documentId, server } = target
  const share = activeShare(await client.listDocumentShares(documentId))
  if (link.access === 'restricted') {
    if (!share) return
    await client.revokeDocumentShare(documentId, share.id)
    await clearShareSecret(server.id, share.id)
    return
  }
  if (share) {
    await client.updateDocumentShare(documentId, share.id, { permission: link.permission })
    return
  }
  const created = await client.createDocumentShare(documentId, { permission: link.permission })
  await saveShareSecret(server.id, created.share.id, created.secret)
}

/** Replaces the link's secret, so old copies stop working and this device can copy it. */
export async function resetCloudLink(target: Target): Promise<void> {
  const { client, documentId, server } = target
  const share = activeShare(await client.listDocumentShares(documentId))
  if (!share) return
  const rotated = await client.rotateDocumentShare(documentId, share.id)
  await saveShareSecret(server.id, rotated.share.id, rotated.secret)
}

/** The link to copy, when this device has its secret. */
export async function cloudLinkURL(target: Target): Promise<string | null> {
  const share = activeShare(await target.client.listDocumentShares(target.documentId))
  if (!share) return null
  const secret = await readShareSecret(target.server.id, share.id)
  return secret ? cloudShareURL(target.discovery, target.server.url, share.id, secret) : null
}
