import { Hono } from 'hono'
import { z } from 'zod'

import { getAuthSession, type InklyAuth } from '../auth/index.js'
import { DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS } from '../notificationStore.js'
import type { BoardStore, NotificationStore, TeamStore, TeamUserRecord } from '../types.js'

export interface NotificationRoutesOptions {
  auth: InklyAuth
  boardStore: BoardStore
  notificationStore: NotificationStore
  teamStore: TeamStore
  env?: NodeJS.ProcessEnv
}

const createMentionSchema = z.object({
  boardId: z.string().trim().min(1),
  mentionedUserId: z.string().trim().min(1),
  sourceUserId: z.string().trim().min(1),
  text: z.string().trim().min(1).max(4_000)
})

const sweepNotificationsSchema = z.object({
  olderThanMs: z.number().int().positive().optional()
})

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function errorResponse(status: number, code: string, message: string) {
  return Response.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  )
}

function dedupeUsers(users: TeamUserRecord[]) {
  const userIds = new Set<string>()
  return users.filter((user) => {
    if (userIds.has(user.id)) return false
    userIds.add(user.id)
    return true
  })
}

function isLocalhostRequest(requestUrl: string) {
  const url = new URL(requestUrl)
  return LOCALHOST_HOSTNAMES.has(url.hostname)
}

function resolveMentionableUsers(options: NotificationRoutesOptions, boardId: string) {
  const board = options.boardStore.findBoard(boardId)
  if (!board) return null

  const owner =
    board.creatorUserId ? options.teamStore.findUserById(board.creatorUserId) ?? null : null
  const teamMembers = board.teamId
    ? options.teamStore.listMembers(board.teamId).map((member) => member.user)
    : []

  return {
    board,
    users: dedupeUsers([...(owner ? [owner] : []), ...teamMembers])
  }
}

export function createNotificationRoutes(options: NotificationRoutesOptions): Hono {
  const app = new Hono()

  app.post('/notifications/sweep', async (c) => {
    if (!isLocalhostRequest(c.req.url)) {
      return errorResponse(403, 'forbidden', 'Sweep is only available from localhost')
    }

    const configuredToken = options.env?.INKLY_API_SWEEP_TOKEN?.trim() ?? ''
    if (!configuredToken) {
      return errorResponse(503, 'sweep_unavailable', 'Sweep token is not configured')
    }

    const providedToken = c.req.header('X-Sweep-Token')?.trim() ?? ''
    if (providedToken !== configuredToken) {
      return errorResponse(403, 'forbidden', 'Invalid sweep token')
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = sweepNotificationsSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    const olderThanMs = parsed.data.olderThanMs ?? DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS
    const deletedCount = options.notificationStore.sweepOldNotifications(olderThanMs)
    console.log(
      `[inkly-api] Notification sweep deleted ${deletedCount} records older than ${olderThanMs}ms`
    )

    return c.json({ deletedCount })
  })

  app.get('/notifications', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    return c.json({
      notifications: options.notificationStore.listNotificationsForUser(session.user.id)
    })
  })

  app.post('/notifications/:id/read', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const notification = options.notificationStore.markNotificationRead(
      c.req.param('id'),
      session.user.id
    )
    if (!notification) {
      return errorResponse(404, 'notification_not_found', 'Notification not found')
    }

    return c.json({ notification })
  })

  app.post('/notifications/read-all', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    return c.json({
      updatedCount: options.notificationStore.markAllNotificationsRead(session.user.id)
    })
  })

  app.delete('/notifications/:id', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const notification = options.notificationStore.deleteNotification(
      c.req.param('id'),
      session.user.id
    )
    if (!notification) {
      return errorResponse(404, 'notification_not_found', 'Notification not found')
    }

    return c.json({ deleted: true, notification })
  })

  app.post('/notifications/mention', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const body = await c.req.json().catch(() => ({}))
    const parsed = createMentionSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    if (parsed.data.sourceUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Mention sender does not match the active session')
    }

    if (parsed.data.mentionedUserId === session.user.id) {
      return errorResponse(400, 'invalid_mentioned_user', 'Users cannot mention themselves')
    }

    const mentionContext = resolveMentionableUsers(options, parsed.data.boardId)
    if (!mentionContext) {
      return errorResponse(404, 'board_not_found', 'Board not found')
    }

    const sourceMember = mentionContext.users.find((user) => user.id === session.user.id) ?? null
    if (!sourceMember) {
      return errorResponse(
        403,
        'forbidden',
        'Only board collaborators and team members can mention users'
      )
    }

    const mentionedUser =
      mentionContext.users.find((user) => user.id === parsed.data.mentionedUserId) ?? null
    if (!mentionedUser) {
      return errorResponse(
        404,
        'mentioned_user_not_found',
        'Mentioned user not found on this board'
      )
    }

    const teamName = mentionContext.board.teamId
      ? options.teamStore.findTeam(mentionContext.board.teamId)?.name ?? null
      : null
    const url = new URLSearchParams({
      board: mentionContext.board.id,
      name: mentionContext.board.name
    })
    if (teamName) url.set('teamName', teamName)

    const notification = options.notificationStore.createNotification({
      userId: mentionedUser.id,
      type: 'mention',
      payload: {
        boardId: mentionContext.board.id,
        boardName: mentionContext.board.name,
        mentionedByDisplayName: session.user.name.trim() || session.user.email,
        message: parsed.data.text,
        url: `/?${url.toString()}`
      }
    })

    return c.json({ notification }, 201)
  })

  return app
}
