import type {
  CreateDocumentInvitationInput,
  CreateDocumentShareInput,
  DocumentGrant,
  DocumentInvitation,
  DocumentPermission,
  DocumentShare,
  UpdateDocumentShareInput
} from '@open-pencil/cloud/contract'

import type { EditorStore } from '@/app/editor/session'
import { cloudConnectionService, readStoragePreferences } from '@/app/integrations/storage'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'

export type CloudShareCapability = {
  share: DocumentShare
  url: string
}

function cloudBinding(store: EditorStore) {
  const binding = store.getStorageBinding()
  return binding?.providerId === PROVIDER_ID ? binding : null
}

async function cloudClient(store: EditorStore) {
  const binding = cloudBinding(store)
  if (!binding) throw new Error('This document is not stored in OpenPencil Cloud')
  const source = readStoragePreferences(PROVIDER_ID)
  const serverURL = source[SERVER_URL_FIELD]
  if (!serverURL) throw new Error('OpenPencil Cloud server is not configured')
  const connection = await cloudConnectionService.connect(serverURL)
  if (!connection.client) throw new Error('OpenPencil Cloud is not connected')
  return { binding, client: connection.client, serverURL }
}

export function isCloudDocument(store: EditorStore): boolean {
  return cloudBinding(store) !== null
}

export async function resolveCloudShare(
  serverURL: string,
  shareId: string,
  secret: string,
  guestName?: string
) {
  const connection = await cloudConnectionService.connect(serverURL)
  if (!connection.client) throw new Error('OpenPencil Cloud is not connected')
  return connection.client.resolveDocumentShare(shareId, { secret, guestName })
}

export async function loadCloudSharedDocument(
  serverURL: string,
  shareId: string,
  secret: string,
  guestName?: string
) {
  const connection = await cloudConnectionService.connect(serverURL)
  if (!connection.client) throw new Error('OpenPencil Cloud is not connected')
  return connection.client.getSharedDocument(shareId, { secret, guestName })
}

export async function loadCloudSharedCollaborationTicket(
  serverURL: string,
  shareId: string,
  secret: string,
  guestName: string,
  guestId: string
) {
  const connection = await cloudConnectionService.connect(serverURL)
  if (!connection.client) throw new Error('OpenPencil Cloud is not connected')
  return connection.client.getSharedCollaborationTicket(shareId, {
    secret,
    guestName,
    guestId
  })
}

export async function getCloudCollaborationTicket(store: EditorStore) {
  const { binding, client } = await cloudClient(store)
  return client.getCollaborationTicket(binding.documentId)
}

export async function getCloudDocumentAccess(store: EditorStore) {
  const { binding, client } = await cloudClient(store)
  return client.getDocumentAccess(binding.documentId)
}

export async function loadCloudShareState(store: EditorStore) {
  const { binding, client } = await cloudClient(store)
  const [access, shares, grants, invitations] = await Promise.all([
    client.getDocumentAccess(binding.documentId),
    client.listDocumentShares(binding.documentId),
    client.listDocumentGrants(binding.documentId),
    client.listDocumentInvitations(binding.documentId)
  ])
  return { access, shares, grants, invitations }
}

function capabilityURL(serverURL: string, shareId: string, secret: string): string {
  return new URL(
    `/cloud/share/${shareId}?server=${encodeURIComponent(serverURL)}#${secret}`,
    window.location.origin
  ).href
}

export async function createCloudShare(
  store: EditorStore,
  input: CreateDocumentShareInput
): Promise<CloudShareCapability> {
  const { binding, client, serverURL } = await cloudClient(store)
  const capability = await client.createDocumentShare(binding.documentId, input)
  return {
    share: capability.share,
    url: capabilityURL(serverURL, capability.share.id, capability.secret)
  }
}

export async function updateCloudShare(
  store: EditorStore,
  shareId: string,
  input: UpdateDocumentShareInput
): Promise<DocumentShare> {
  const { binding, client } = await cloudClient(store)
  return client.updateDocumentShare(binding.documentId, shareId, input)
}

export async function rotateCloudShare(
  store: EditorStore,
  shareId: string
): Promise<CloudShareCapability> {
  const { binding, client, serverURL } = await cloudClient(store)
  const capability = await client.rotateDocumentShare(binding.documentId, shareId)
  return {
    share: capability.share,
    url: capabilityURL(serverURL, capability.share.id, capability.secret)
  }
}

export async function revokeCloudShare(store: EditorStore, shareId: string): Promise<void> {
  const { binding, client } = await cloudClient(store)
  await client.revokeDocumentShare(binding.documentId, shareId)
}

export async function inviteCloudUser(
  store: EditorStore,
  input: CreateDocumentInvitationInput
): Promise<DocumentInvitation> {
  const { binding, client } = await cloudClient(store)
  return (await client.createDocumentInvitation(binding.documentId, input)).invitation
}

export async function updateCloudGrant(
  store: EditorStore,
  userId: string,
  permission: DocumentPermission
): Promise<DocumentGrant> {
  const { binding, client } = await cloudClient(store)
  return client.putDocumentGrant(binding.documentId, userId, { permission })
}

export async function revokeCloudGrant(store: EditorStore, userId: string): Promise<void> {
  const { binding, client } = await cloudClient(store)
  await client.revokeDocumentGrant(binding.documentId, userId)
}

export async function revokeCloudInvitation(
  store: EditorStore,
  invitationId: string
): Promise<void> {
  const { binding, client } = await cloudClient(store)
  await client.revokeDocumentInvitation(binding.documentId, invitationId)
}
