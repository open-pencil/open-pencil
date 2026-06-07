export const INVITATION_ISSUER = 'inkly' as const

export const INVITATION_ROLES = ['editor', 'viewer'] as const

export type InvitationRole = (typeof INVITATION_ROLES)[number]

export const TEAM_MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const

export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]

export const NOTIFICATION_TYPES = ['invitation', 'team_invite', 'mention'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

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
  createInvitation(input: CreateInvitationInput): Promise<InvitationRecord>
  findInvitation(id: string): Promise<InvitationRecord | null>
  listInvitationsByBoardId(boardId: string): Promise<InvitationRecord[]>
  attachInvitationToken(id: string, token: string): Promise<InvitationRecord | null>
  revokeInvitation(id: string): Promise<InvitationRecord | null>
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
  createBoard(input: CreateBoardInput): Promise<BoardRecord>
  findBoard(id: string): Promise<BoardRecord | null>
  listBoardsForAnonymous(anonymousId: string): Promise<BoardRecord[]>
  listBoardsForUser(userId: string): Promise<BoardRecord[]>
  listBoardsForTeam(teamId: string): Promise<BoardRecord[]>
  deleteBoard(id: string): Promise<BoardRecord | null>
  addCollaborator(boardId: string, input: AddBoardCollaboratorInput): Promise<BoardRecord | null>
  updateBoard(id: string, input: UpdateBoardInput): Promise<BoardRecord | null>
  clearTeamForBoards(teamId: string): Promise<number>
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

export interface InvitationNotificationPayload {
  invitationId: string
  boardId: string
  boardName: string
  role: InvitationRole
  inviterDisplayName: string
  inviteeEmail: string
  url: string
}

export interface TeamInviteNotificationPayload {
  teamId: string
  teamName: string
  role: Exclude<TeamMemberRole, 'owner'>
  inviterDisplayName: string
  inviteeEmail: string
  url: string
}

export interface MentionNotificationPayload {
  boardId: string
  boardName: string
  mentionedByDisplayName: string
  message: string
  url: string
}

export type NotificationPayload =
  | InvitationNotificationPayload
  | TeamInviteNotificationPayload
  | MentionNotificationPayload

export interface NotificationRecord {
  id: string
  userId: string
  type: NotificationType
  payload: NotificationPayload
  readAt: number | null
  createdAt: number
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  payload: NotificationPayload
}

export interface NotificationStore {
  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>
  findNotification(id: string): Promise<NotificationRecord | null>
  findUserByEmail(email: string): Promise<TeamUserRecord | null>
  listNotificationsForUser(userId: string): Promise<NotificationRecord[]>
  markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null>
  markAllNotificationsRead(userId: string): Promise<number>
  deleteNotification(id: string, userId: string): Promise<NotificationRecord | null>
  sweepOldNotifications(olderThanMs?: number): Promise<number>
}

export interface TeamStore {
  createTeam(input: CreateTeamInput): Promise<TeamRecord>
  findTeam(id: string): Promise<TeamRecord | null>
  listTeamsForUser(userId: string): Promise<TeamMembershipRecord[]>
  listMembers(teamId: string): Promise<TeamMemberRecord[]>
  findMembership(teamId: string, userId: string): Promise<TeamMemberRecord | null>
  findUserById(userId: string): Promise<TeamUserRecord | null>
  findUserByEmail(email: string): Promise<TeamUserRecord | null>
  addMember(input: AddTeamMemberInput): Promise<TeamMemberRecord | null>
  updateMemberRole(
    teamId: string,
    userId: string,
    role: Exclude<TeamMemberRole, 'owner'>
  ): Promise<TeamMemberRecord | null>
  removeMember(teamId: string, userId: string): Promise<TeamMemberRecord | null>
  updateTeam(id: string, input: UpdateTeamInput): Promise<TeamRecord | null>
  deleteTeam(id: string): Promise<TeamRecord | null>
}
