import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import type { BoardCollaboratorRecord, InvitationRole, TeamMemberRole } from '../types.js'

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  creatorAnonymousId: text('creator_anonymous_id').notNull(),
  creatorUserId: text('creator_user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull()
})

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull(),
    sentToEmailHash: text('sent_to_email_hash').notNull(),
    role: text('role').$type<InvitationRole>().notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
    revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
    jti: text('jti').notNull(),
    token: text('token')
  },
  (table) => [index('invitations_board_id_idx').on(table.boardId)]
)

export const collaborators = sqliteTable(
  'collaborators',
  {
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    anonymousId: text('anonymous_id').notNull(),
    role: text('role').$type<BoardCollaboratorRecord['role']>().notNull(),
    addedAt: integer('added_at', { mode: 'number' }).notNull(),
    invitationId: text('invitation_id')
  },
  (table) => [
    primaryKey({ columns: [table.boardId, table.anonymousId] }),
    index('collaborators_anonymous_id_idx').on(table.anonymousId),
    index('collaborators_invitation_id_idx').on(table.invitationId)
  ]
)

export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<TeamMemberRole>().notNull(),
    addedAt: integer('added_at', { mode: 'number' }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index('team_members_user_id_idx').on(table.userId),
    index('team_members_role_idx').on(table.role)
  ]
)

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)]
)

export const teams = sqliteTable(
  'teams',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull()
  },
  (table) => [index('teams_owner_user_id_idx').on(table.ownerUserId)]
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [
    uniqueIndex('sessions_token_unique').on(table.token),
    index('sessions_user_id_idx').on(table.userId)
  ]
)

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)]
)
