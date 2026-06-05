import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import type { ApiDatabase } from '../db/client.js'
import {
  accounts,
  boards,
  collaborators,
  invitations,
  notifications,
  sessions,
  teamMembers,
  teams,
  users
} from '../db/schema.js'
import type {
  BoardStore,
  InvitationStore,
  NotificationStore,
  TeamStore,
  TeamUserRecord
} from '../types.js'

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const TEST_TIME_BASE = Date.parse('2026-01-01T12:00:00.000Z')
const TEST_TIME_STEP_MS = 60_000
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

let timestampSequence = 0

const seedUserSchema = z.object({
  id: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120),
  image: z.string().trim().url().nullable().optional()
})

const seedBoardOwnerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('anonymous'),
    anonymousId: z.string().trim().min(1)
  }),
  z.object({
    kind: z.literal('user'),
    user: seedUserSchema
  })
])

const seedBoardsSchema = z.object({
  count: z.number().int().min(0).max(20),
  names: z.array(z.string().trim().min(1).max(120)).optional(),
  teamId: z.string().trim().min(1).nullable().optional(),
  owner: seedBoardOwnerSchema
})

const seedTeamMemberSchema = seedUserSchema.extend({
  role: z.enum(['editor', 'viewer']).default('editor')
})

const seedTeamSchema = z.object({
  owner: seedUserSchema,
  name: z.string().trim().min(1).max(120),
  members: z.array(seedTeamMemberSchema).default([]),
  boards: z.array(z.string().trim().min(1).max(120)).default([])
})

const invitationNotificationSchema = z.object({
  type: z.literal('invitation'),
  read: z.boolean().default(false),
  payload: z.object({
    invitationId: z.string().trim().min(1),
    boardId: z.string().trim().min(1),
    boardName: z.string().trim().min(1),
    role: z.enum(['editor', 'viewer']),
    inviterDisplayName: z.string().trim().min(1),
    inviteeEmail: z.string().trim().email(),
    url: z.string().trim().min(1)
  })
})

const teamInviteNotificationSchema = z.object({
  type: z.literal('team_invite'),
  read: z.boolean().default(false),
  payload: z.object({
    teamId: z.string().trim().min(1),
    teamName: z.string().trim().min(1),
    role: z.enum(['editor', 'viewer']),
    inviterDisplayName: z.string().trim().min(1),
    inviteeEmail: z.string().trim().email(),
    url: z.string().trim().min(1)
  })
})

const mentionNotificationSchema = z.object({
  type: z.literal('mention'),
  read: z.boolean().default(false),
  payload: z.object({
    boardId: z.string().trim().min(1),
    boardName: z.string().trim().min(1),
    mentionedByDisplayName: z.string().trim().min(1),
    message: z.string().trim().min(1).max(4000),
    url: z.string().trim().min(1)
  })
})

const seedNotificationsSchema = z.object({
  user: seedUserSchema,
  items: z
    .array(
      z.discriminatedUnion('type', [
        invitationNotificationSchema,
        teamInviteNotificationSchema,
        mentionNotificationSchema
      ])
    )
    .min(0)
    .max(20)
})

const seedInvitationsSchema = z.object({
  boardId: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        email: z.string().trim().email(),
        role: z.enum(['editor', 'viewer']).default('editor')
      })
    )
    .min(0)
    .max(20)
})

export interface TestingRoutesOptions {
  enabled: boolean
  database: ApiDatabase
  boardStore: BoardStore
  invitationStore: InvitationStore
  teamStore: TeamStore
  notificationStore: NotificationStore
}

function isLocalhostRequest(requestUrl: string) {
  const url = new URL(requestUrl)
  return LOCALHOST_HOSTNAMES.has(url.hostname)
}

function testingUnavailable() {
  return Response.json(
    {
      error: {
        code: 'not_found',
        message: 'Test helpers are not enabled'
      }
    },
    { status: 404 }
  )
}

function ensureTestingRequest(options: TestingRoutesOptions, requestUrl: string) {
  if (!options.enabled) return testingUnavailable()
  if (!isLocalhostRequest(requestUrl)) {
    return Response.json(
      {
        error: {
          code: 'forbidden',
          message: 'Test helpers are only available from localhost'
        }
      },
      { status: 403 }
    )
  }

  return null
}

function resetDatabase(database: ApiDatabase) {
  timestampSequence = 0
  database.db.transaction((tx) => {
    tx.delete(notifications).run()
    tx.delete(sessions).run()
    tx.delete(accounts).run()
    tx.delete(teamMembers).run()
    tx.delete(collaborators).run()
    tx.delete(invitations).run()
    tx.delete(boards).run()
    tx.delete(teams).run()
    tx.delete(users).run()
  })
}

function nextTimestamp() {
  const timestamp = TEST_TIME_BASE + timestampSequence * TEST_TIME_STEP_MS
  timestampSequence += 1
  return timestamp
}

function applyBoardTimestamp(database: ApiDatabase, boardId: string, timestamp: number) {
  database.db
    .update(boards)
    .set({
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(boards.id, boardId))
    .run()

  database.db
    .update(collaborators)
    .set({ addedAt: timestamp })
    .where(eq(collaborators.boardId, boardId))
    .run()
}

function applyTeamTimestamp(database: ApiDatabase, teamId: string, timestamp: number) {
  database.db
    .update(teams)
    .set({
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(teams.id, teamId))
    .run()
}

function applyTeamMemberTimestamp(
  database: ApiDatabase,
  teamId: string,
  userId: string,
  timestamp: number
) {
  database.db
    .update(teamMembers)
    .set({ addedAt: timestamp })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .run()
}

function applyNotificationTimestamp(
  database: ApiDatabase,
  notificationId: string,
  createdAt: number,
  readAt: number | null
) {
  database.db
    .update(notifications)
    .set({
      createdAt,
      readAt
    })
    .where(eq(notifications.id, notificationId))
    .run()
}

function upsertUser(database: ApiDatabase, input: z.infer<typeof seedUserSchema>): TeamUserRecord {
  const email = input.email.trim().toLowerCase()
  const existing =
    (input.id
      ? database.db.select().from(users).where(eq(users.id, input.id)).get()
      : null) ??
    database.db.select().from(users).where(eq(users.email, email)).get()
  const now = Date.now()

  if (existing) {
    database.db
      .update(users)
      .set({
        name: input.name,
        email,
        image: input.image ?? null,
        emailVerified: true,
        updatedAt: new Date(now)
      })
      .where(eq(users.id, existing.id))
      .run()

    return {
      id: existing.id,
      name: input.name,
      email,
      image: input.image ?? null
    }
  }

  const userId = input.id ?? crypto.randomUUID()
  database.db
    .insert(users)
    .values({
      id: userId,
      name: input.name,
      email,
      image: input.image ?? null,
      emailVerified: true,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
    .run()

  return {
    id: userId,
    name: input.name,
    email,
    image: input.image ?? null
  }
}

function seedBoards(options: TestingRoutesOptions, input: z.infer<typeof seedBoardsSchema>) {
  const names = Array.from({ length: input.count }, (_, index) =>
    input.names?.[index] || `Visual Board ${index + 1}`
  )

  return names.slice(0, input.count).map((name) => {
    const record =
      input.owner.kind === 'anonymous'
        ? options.boardStore.createBoard({
            name,
            creatorAnonymousId: input.owner.anonymousId,
            creatorUserId: null,
            teamId: input.teamId ?? null
          })
        : (() => {
            const owner = upsertUser(options.database, input.owner.user)
            return options.boardStore.createBoard({
              name,
              creatorAnonymousId: '',
              creatorUserId: owner.id,
              teamId: input.teamId ?? null
            })
          })()
    applyBoardTimestamp(options.database, record.id, nextTimestamp())
    return options.boardStore.findBoard(record.id) ?? record
  })
}

function seedTeam(options: TestingRoutesOptions, input: z.infer<typeof seedTeamSchema>) {
  const owner = upsertUser(options.database, input.owner)
  const team = options.teamStore.createTeam({
    name: input.name,
    ownerUserId: owner.id
  })
  const createdAt = nextTimestamp()
  let lastUpdatedAt = createdAt
  applyTeamTimestamp(options.database, team.id, createdAt)
  applyTeamMemberTimestamp(options.database, team.id, owner.id, createdAt)

  for (const member of input.members) {
    const savedUser = upsertUser(options.database, member)
    if (savedUser.id === owner.id) continue
    options.teamStore.addMember({
      teamId: team.id,
      userId: savedUser.id,
      role: member.role
    })
    const memberTimestamp = nextTimestamp()
    applyTeamMemberTimestamp(options.database, team.id, savedUser.id, memberTimestamp)
    lastUpdatedAt = memberTimestamp
  }

  for (const boardName of input.boards) {
    const board = options.boardStore.createBoard({
      name: boardName,
      creatorAnonymousId: '',
      creatorUserId: owner.id,
      teamId: team.id
    })
    const boardTimestamp = nextTimestamp()
    applyBoardTimestamp(options.database, board.id, boardTimestamp)
    lastUpdatedAt = boardTimestamp
  }

  options.database.db
    .update(teams)
    .set({ updatedAt: lastUpdatedAt })
    .where(eq(teams.id, team.id))
    .run()

  const members = options.teamStore.listMembers(team.id)
  const boards = options.boardStore.listBoardsForTeam(team.id)

  return {
    team,
    members,
    boards
  }
}

function setNotificationReadState(
  database: ApiDatabase,
  notificationId: string,
  read: boolean
) {
  const createdAt = nextTimestamp()
  applyNotificationTimestamp(database, notificationId, createdAt, read ? createdAt + 1 : null)
}

function seedNotifications(options: TestingRoutesOptions, input: z.infer<typeof seedNotificationsSchema>) {
  const user = upsertUser(options.database, input.user)

  for (const item of input.items) {
    const record = options.notificationStore.createNotification({
      userId: user.id,
      type: item.type,
      payload: item.payload
    })
    setNotificationReadState(options.database, record.id, item.read)
  }

  return options.notificationStore.listNotificationsForUser(user.id)
}

function seedInvitations(options: TestingRoutesOptions, input: z.infer<typeof seedInvitationsSchema>) {
  const created = input.items.map((item, index) => {
    const createdAt = nextTimestamp()
    const invitation = options.invitationStore.createInvitation({
      boardId: input.boardId,
      sentToEmailHash: item.email,
      role: item.role,
      expiresAt: createdAt + INVITATION_TTL_MS
    })
    const token = `test-invitation-${index + 1}-${invitation.id}`
    options.database.db
      .update(invitations)
      .set({
        createdAt,
        expiresAt: createdAt + INVITATION_TTL_MS,
        token
      })
      .where(eq(invitations.id, invitation.id))
      .run()

    return options.invitationStore.findInvitation(invitation.id) ?? invitation
  })

  return created
}

export function createTestingRoutes(options: TestingRoutesOptions): Hono {
  const app = new Hono()

  app.post('/reset', (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    resetDatabase(options.database)
    return c.json({ reset: true })
  })

  app.post('/seed/boards', async (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    const body = await c.req.json().catch(() => ({}))
    const parsed = seedBoardsSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json({ error: { code: 'invalid_request_body', message: issue } }, 400)
    }

    return c.json({ boards: seedBoards(options, parsed.data) }, 201)
  })

  app.post('/seed/team', async (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    const body = await c.req.json().catch(() => ({}))
    const parsed = seedTeamSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json({ error: { code: 'invalid_request_body', message: issue } }, 400)
    }

    return c.json(seedTeam(options, parsed.data), 201)
  })

  app.post('/seed/notifications', async (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    const body = await c.req.json().catch(() => ({}))
    const parsed = seedNotificationsSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json({ error: { code: 'invalid_request_body', message: issue } }, 400)
    }

    return c.json({ notifications: seedNotifications(options, parsed.data) }, 201)
  })

  app.post('/seed/invitations', async (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    const body = await c.req.json().catch(() => ({}))
    const parsed = seedInvitationsSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json({ error: { code: 'invalid_request_body', message: issue } }, 400)
    }

    return c.json({ invitations: seedInvitations(options, parsed.data) }, 201)
  })

  return app
}
