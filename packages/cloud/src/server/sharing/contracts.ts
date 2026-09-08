import type {
  DocumentGrant,
  DocumentInvitation,
  DocumentPermission,
  DocumentShare
} from '#cloud/contract'

export function dateString(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : value
}

export function shareContract(row: {
  id: string
  documentId: string
  permission: DocumentPermission
  roomEpoch: number
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
  expiresAt: Date | string | null
  revokedAt: Date | string | null
  lastUsedAt: Date | string | null
}): DocumentShare {
  return {
    ...row,
    createdAt: dateString(row.createdAt) ?? '',
    updatedAt: dateString(row.updatedAt) ?? '',
    expiresAt: dateString(row.expiresAt),
    revokedAt: dateString(row.revokedAt),
    lastUsedAt: dateString(row.lastUsedAt)
  }
}

export function grantContract(row: {
  id: string
  documentId: string
  userId: string
  permission: DocumentPermission
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
}): DocumentGrant {
  return {
    ...row,
    createdAt: dateString(row.createdAt) ?? '',
    updatedAt: dateString(row.updatedAt) ?? ''
  }
}

export function invitationContract(row: {
  id: string
  documentId: string
  emailNormalized: string
  permission: DocumentPermission
  invitedBy: string
  invitedAt: Date | string
  expiresAt: Date | string
  acceptedAt: Date | string | null
}): DocumentInvitation {
  return {
    id: row.id,
    documentId: row.documentId,
    email: row.emailNormalized,
    permission: row.permission,
    invitedBy: row.invitedBy,
    invitedAt: dateString(row.invitedAt) ?? '',
    expiresAt: dateString(row.expiresAt) ?? '',
    acceptedAt: dateString(row.acceptedAt)
  }
}
