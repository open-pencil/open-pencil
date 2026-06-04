export const INVITATION_ISSUER = 'inkly' as const

export const INVITATION_ROLES = ['editor', 'viewer'] as const

export type InvitationRole = (typeof INVITATION_ROLES)[number]

export interface InvitationPayload {
  iss: typeof INVITATION_ISSUER
  sub: string
  board_id: string
  role: InvitationRole
  email_hash: string
  exp: number
  iat: number
  jti: string
}

export interface InvitationRecord {
  id: string
  boardId: string
  sentToEmailHash: string
  role: InvitationRole
  createdAt: number
  expiresAt: number
  revoked: boolean
  jti: string
}

export interface CreateInvitationInput {
  boardId: string
  sentToEmailHash: string
  role: InvitationRole
  expiresAt: number
}

export interface InvitationStore {
  createInvitation(input: CreateInvitationInput): InvitationRecord
  findInvitation(id: string): InvitationRecord | null
  revokeInvitation(id: string): InvitationRecord | null
}

export type InvitationVerifyFailureReason =
  | 'expired'
  | 'revoked'
  | 'invalid_signature'
  | 'malformed'
