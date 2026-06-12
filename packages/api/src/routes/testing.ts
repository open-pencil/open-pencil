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
  BoardRecord,
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

export const seedUserSchema = z.object({
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
        role: z.enum(['editor', 'viewer']).default('editor'),
        expiresInMs: z.number().int().optional()
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

async function resetDatabase(database: ApiDatabase) {
  timestampSequence = 0
  await database.db.transaction(async (tx) => {
    await tx.delete(notifications).run()
    await tx.delete(sessions).run()
    await tx.delete(accounts).run()
    await tx.delete(teamMembers).run()
    await tx.delete(collaborators).run()
    await tx.delete(invitations).run()
    await tx.delete(boards).run()
    await tx.delete(teams).run()
    await tx.delete(users).run()
  })
}

function nextTimestamp() {
  const timestamp = TEST_TIME_BASE + timestampSequence * TEST_TIME_STEP_MS
  timestampSequence += 1
  return timestamp
}

async function applyBoardTimestamp(database: ApiDatabase, boardId: string, timestamp: number) {
  await database.db
    .update(boards)
    .set({
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(boards.id, boardId))
    .run()

  await database.db
    .update(collaborators)
    .set({ addedAt: timestamp })
    .where(eq(collaborators.boardId, boardId))
    .run()
}

async function applyTeamTimestamp(database: ApiDatabase, teamId: string, timestamp: number) {
  await database.db
    .update(teams)
    .set({
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(teams.id, teamId))
    .run()
}

async function applyTeamMemberTimestamp(
  database: ApiDatabase,
  teamId: string,
  userId: string,
  timestamp: number
) {
  await database.db
    .update(teamMembers)
    .set({ addedAt: timestamp })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .run()
}

async function applyNotificationTimestamp(
  database: ApiDatabase,
  notificationId: string,
  createdAt: number,
  readAt: number | null
) {
  await database.db
    .update(notifications)
    .set({
      createdAt,
      readAt
    })
    .where(eq(notifications.id, notificationId))
    .run()
}

export async function upsertUser(
  database: ApiDatabase,
  input: z.infer<typeof seedUserSchema>
): Promise<TeamUserRecord> {
  const email = input.email.trim().toLowerCase()
  const now = Date.now()
  const image = input.image ?? null

  // SELECT → INSERT の 2 段だと並列 seedBoards (例 admin test の Promise.all)
  // で同 email が同時に existing=null と判定されて N 個 insert を試みて
  // UNIQUE (users.email) 違反 → 500 になる。 onConflictDoUpdate で atomic に
  // upsert することで race 経路を消す。
  const candidateId = input.id ?? crypto.randomUUID()

  await database.db
    .insert(users)
    .values({
      id: candidateId,
      name: input.name,
      email,
      image,
      emailVerified: true,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: input.name,
        image,
        emailVerified: true,
        updatedAt: new Date(now)
      }
    })
    .run()

  // 既存 row があれば conflict 経路で id は変わらない、 新規なら candidateId が採用される。
  // 必ず email でひいて real id を返す (caller が collaborator 等の FK に使うため)。
  const persisted = await database.db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!persisted) {
    throw new Error(`upsertUser: failed to persist user for email=${email}`)
  }

  return {
    id: persisted.id,
    name: input.name,
    email,
    image
  }
}

async function seedBoards(options: TestingRoutesOptions, input: z.infer<typeof seedBoardsSchema>) {
  const names = Array.from({ length: input.count }, (_, index) =>
    input.names?.[index] || `Visual Board ${index + 1}`
  )

  // 並列 (Promise.all) で createBoard を実行すると libsql の単一 connection で
  // transaction が衝突して SQLITE_BUSY を起こす。 admin / dashboard 系 e2e の
  // seedBoards count=3 が 500 で fail していた根本原因。
  // user 経路では upsertUser を 1 度だけ先行実行して、 board 作成自体は順番に回す。
  const owner =
    input.owner.kind === 'user'
      ? await upsertUser(options.database, input.owner.user)
      : null

  const results: BoardRecord[] = []
  for (const name of names.slice(0, input.count)) {
    let record: BoardRecord
    if (input.owner.kind === 'anonymous') {
      record = await options.boardStore.createBoard({
        name,
        creatorAnonymousId: input.owner.anonymousId,
        creatorUserId: null,
        teamId: input.teamId ?? null
      })
    } else {
      // owner は loop 外で 1 度だけ upsert 済み (kind === 'user' なら non-null)。
      record = await options.boardStore.createBoard({
        name,
        creatorAnonymousId: '',
        creatorUserId: owner!.id,
        teamId: input.teamId ?? null
      })
    }
    await applyBoardTimestamp(options.database, record.id, nextTimestamp())
    results.push((await options.boardStore.findBoard(record.id)) ?? record)
  }
  return results
}

async function seedTeam(options: TestingRoutesOptions, input: z.infer<typeof seedTeamSchema>) {
  const owner = await upsertUser(options.database, input.owner)
  const team = await options.teamStore.createTeam({
    name: input.name,
    ownerUserId: owner.id
  })
  const createdAt = nextTimestamp()
  let lastUpdatedAt = createdAt
  await applyTeamTimestamp(options.database, team.id, createdAt)
  await applyTeamMemberTimestamp(options.database, team.id, owner.id, createdAt)

  for (const member of input.members) {
    const savedUser = await upsertUser(options.database, member)
    if (savedUser.id === owner.id) continue
    await options.teamStore.addMember({
      teamId: team.id,
      userId: savedUser.id,
      role: member.role
    })
    const memberTimestamp = nextTimestamp()
    await applyTeamMemberTimestamp(options.database, team.id, savedUser.id, memberTimestamp)
    lastUpdatedAt = memberTimestamp
  }

  for (const boardName of input.boards) {
    const board = await options.boardStore.createBoard({
      name: boardName,
      creatorAnonymousId: '',
      creatorUserId: owner.id,
      teamId: team.id
    })
    const boardTimestamp = nextTimestamp()
    await applyBoardTimestamp(options.database, board.id, boardTimestamp)
    lastUpdatedAt = boardTimestamp
  }

  await options.database.db
    .update(teams)
    .set({ updatedAt: lastUpdatedAt })
    .where(eq(teams.id, team.id))
    .run()

  const members = await options.teamStore.listMembers(team.id)
  const boards = await options.boardStore.listBoardsForTeam(team.id)

  return {
    team,
    members,
    boards
  }
}

async function setNotificationReadState(
  database: ApiDatabase,
  notificationId: string,
  read: boolean
) {
  const createdAt = nextTimestamp()
  await applyNotificationTimestamp(database, notificationId, createdAt, read ? createdAt + 1 : null)
}

async function seedNotifications(
  options: TestingRoutesOptions,
  input: z.infer<typeof seedNotificationsSchema>
) {
  const user = await upsertUser(options.database, input.user)

  for (const item of input.items) {
    const record = await options.notificationStore.createNotification({
      userId: user.id,
      type: item.type,
      payload: item.payload
    })
    await setNotificationReadState(options.database, record.id, item.read)
  }

  return await options.notificationStore.listNotificationsForUser(user.id)
}

async function seedInvitations(
  options: TestingRoutesOptions,
  input: z.infer<typeof seedInvitationsSchema>
) {
  const created = await Promise.all(input.items.map(async (item, index) => {
    const createdAt = nextTimestamp()
    const expiresAt = createdAt + (item.expiresInMs ?? INVITATION_TTL_MS)
    const invitation = await options.invitationStore.createInvitation({
      boardId: input.boardId,
      sentToEmailHash: item.email,
      role: item.role,
      expiresAt
    })
    const token = `test-invitation-${index + 1}-${invitation.id}`
    await options.database.db
      .update(invitations)
      .set({
        createdAt,
        expiresAt,
        token
      })
      .where(eq(invitations.id, invitation.id))
      .run()

    return (await options.invitationStore.findInvitation(invitation.id)) ?? invitation
  }))

  return created
}

export function createTestingRoutes(options: TestingRoutesOptions): Hono {
  const app = new Hono()

  app.post('/reset', async (c) => {
    const failure = ensureTestingRequest(options, c.req.url)
    if (failure) return failure

    await resetDatabase(options.database)
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

    return c.json({ boards: await seedBoards(options, parsed.data) }, 201)
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

    return c.json(await seedTeam(options, parsed.data), 201)
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

    return c.json({ notifications: await seedNotifications(options, parsed.data) }, 201)
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

    return c.json({ invitations: await seedInvitations(options, parsed.data) }, 201)
  })

  return app
}
