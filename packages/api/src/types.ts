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
  token: string | null
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
  listInvitationsByBoardId(boardId: string): InvitationRecord[]
  attachInvitationToken(id: string, token: string): InvitationRecord | null
  revokeInvitation(id: string): InvitationRecord | null
}

export type InvitationVerifyFailureReason =
  | 'expired'
  | 'revoked'
  | 'invalid_signature'
  | 'malformed'

export interface BoardCollaboratorRecord {
  anonymousId: string
  role: InvitationRole | 'owner'
  addedAt: number
  invitationId: string | null
}

export interface BoardRecord {
  id: string
  name: string
  creatorAnonymousId: string
  createdAt: number
  updatedAt: number
  collaborators: BoardCollaboratorRecord[]
}

export interface CreateBoardInput {
  name: string
  creatorAnonymousId: string
}

export interface AddBoardCollaboratorInput {
  anonymousId: string
  role: InvitationRole
  invitationId: string
}

export interface BoardStore {
  createBoard(input: CreateBoardInput): BoardRecord
  findBoard(id: string): BoardRecord | null
  listBoardsForAnonymous(anonymousId: string): BoardRecord[]
  deleteBoard(id: string): BoardRecord | null
  addCollaborator(boardId: string, input: AddBoardCollaboratorInput): BoardRecord | null
}
