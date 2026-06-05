export const INVITATION_ISSUER = 'inkly' as const

export const INVITATION_ROLES = ['editor', 'viewer'] as const

export type InvitationRole = (typeof INVITATION_ROLES)[number]

export const TEAM_MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const

export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]

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
  creatorUserId: string | null
  teamId: string | null
  createdAt: number
  updatedAt: number
  collaborators: BoardCollaboratorRecord[]
}

export interface CreateBoardInput {
  name: string
  creatorAnonymousId?: string | null
  creatorUserId?: string | null
  teamId?: string | null
}

export interface AddBoardCollaboratorInput {
  anonymousId: string
  role: InvitationRole
  invitationId: string
}

export interface UpdateBoardInput {
  name?: string
  teamId?: string | null
}

export interface BoardStore {
  createBoard(input: CreateBoardInput): BoardRecord
  findBoard(id: string): BoardRecord | null
  listBoardsForAnonymous(anonymousId: string): BoardRecord[]
  listBoardsForUser(userId: string): BoardRecord[]
  listBoardsForTeam(teamId: string): BoardRecord[]
  deleteBoard(id: string): BoardRecord | null
  addCollaborator(boardId: string, input: AddBoardCollaboratorInput): BoardRecord | null
  updateBoard(id: string, input: UpdateBoardInput): BoardRecord | null
  clearTeamForBoards(teamId: string): number
}

export interface TeamRecord {
  id: string
  name: string
  ownerUserId: string
  createdAt: number
  updatedAt: number
}

export interface TeamUserRecord {
  id: string
  name: string
  email: string
  image: string | null
}

export interface TeamMemberRecord {
  teamId: string
  userId: string
  role: TeamMemberRole
  addedAt: number
  user: TeamUserRecord
}

export interface TeamMembershipRecord {
  team: TeamRecord
  role: TeamMemberRole
}

export interface CreateTeamInput {
  name: string
  ownerUserId: string
}

export interface AddTeamMemberInput {
  teamId: string
  userId: string
  role: Exclude<TeamMemberRole, 'owner'>
}

export interface UpdateTeamInput {
  name: string
}

export interface TeamStore {
  createTeam(input: CreateTeamInput): TeamRecord
  findTeam(id: string): TeamRecord | null
  listTeamsForUser(userId: string): TeamMembershipRecord[]
  listMembers(teamId: string): TeamMemberRecord[]
  findMembership(teamId: string, userId: string): TeamMemberRecord | null
  findUserById(userId: string): TeamUserRecord | null
  findUserByEmail(email: string): TeamUserRecord | null
  addMember(input: AddTeamMemberInput): TeamMemberRecord | null
  updateMemberRole(
    teamId: string,
    userId: string,
    role: Exclude<TeamMemberRole, 'owner'>
  ): TeamMemberRecord | null
  removeMember(teamId: string, userId: string): TeamMemberRecord | null
  updateTeam(id: string, input: UpdateTeamInput): TeamRecord | null
  deleteTeam(id: string): TeamRecord | null
}
