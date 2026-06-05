import { Hono } from 'hono'
import { z } from 'zod'

import { resolveAnonymousId } from '../anonymousId.js'
import { getAuthSession, type InklyAuth } from '../auth/index.js'
import { isBoardOwner, resolveRequestActor } from '../auth/actor.js'
import type { BoardStore, InvitationStore, TeamStore } from '../types.js'

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Untitled board'),
  teamId: z.string().trim().min(1).nullable().optional()
})

const updateBoardSchema = z.object({
  teamId: z.string().trim().min(1).nullable().optional()
})

interface ValidationErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface BoardRoutesOptions {
  auth: InklyAuth
  boardStore: BoardStore
  invitationStore: InvitationStore
  teamStore: TeamStore
}

function validationError(message: string): ValidationErrorBody {
  return {
    error: {
      code: 'invalid_request_body',
      message
    }
  }
}

function unauthorizedResponse() {
  return Response.json(
    {
      error: {
        code: 'unauthorized',
        message: 'Login required'
      }
    },
    { status: 401 }
  )
}

function forbiddenResponse(message: string) {
  return Response.json(
    {
      error: {
        code: 'forbidden',
        message
      }
    },
    { status: 403 }
  )
}

function notFoundResponse(code: string, message: string) {
  return Response.json(
    {
      error: {
        code,
        message
      }
    },
    { status: 404 }
  )
}

function attachTeamSummaries(
  boards: ReturnType<BoardStore['listBoardsForAnonymous']>,
  teamStore: TeamStore
) {
  const teamIds = [...new Set(boards.map((board) => board.teamId).filter((teamId) => !!teamId))]
  const teamsById = new Map(
    teamIds.map((teamId) => {
      const team = teamStore.findTeam(teamId)
      return [teamId, team ? { id: team.id, name: team.name } : null] as const
    })
  )

  return boards.map((board) => ({
    ...board,
    team: board.teamId ? (teamsById.get(board.teamId) ?? null) : null
  }))
}

function mergeBoards(
  personalBoards: ReturnType<BoardStore['listBoardsForUser']>,
  teamBoards: ReturnType<BoardStore['listBoardsForTeam']>
) {
  const merged = new Map<string, (typeof personalBoards)[number]>()

  for (const board of [...personalBoards, ...teamBoards]) {
    const existing = merged.get(board.id)
    if (!existing || existing.updatedAt < board.updatedAt) {
      merged.set(board.id, board)
    }
  }

  return [...merged.values()].sort((left, right) => right.updatedAt - left.updatedAt)
}

export function createBoardRoutes(options: BoardRoutesOptions): Hono {
  const app = new Hono()

  app.get('/boards', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)

    if (!session) {
      const anonymousId = resolveAnonymousId(c)
      const boards = options.boardStore.listBoardsForAnonymous(anonymousId)
      return c.json({ boards: attachTeamSummaries(boards, options.teamStore) })
    }

    const memberships = options.teamStore.listTeamsForUser(session.user.id)
    const personalBoards = options.boardStore.listBoardsForUser(session.user.id)
    const teamBoards = memberships.flatMap((membership) =>
      options.boardStore.listBoardsForTeam(membership.team.id)
    )

    return c.json({
      boards: attachTeamSummaries(mergeBoards(personalBoards, teamBoards), options.teamStore)
    })
  })

  app.post('/boards', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = createBoardSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const session = await getAuthSession(options.auth, c.req.raw)
    const teamId = parsed.data.teamId?.trim() || null

    if (teamId) {
      if (!session) return unauthorizedResponse()
      const team = options.teamStore.findTeam(teamId)
      if (!team) return notFoundResponse('team_not_found', 'Team not found')
      if (team.ownerUserId !== session.user.id) {
        return forbiddenResponse('Only the team owner can create team boards')
      }
    }

    if (session) {
      const board = options.boardStore.createBoard({
        name: parsed.data.name,
        creatorAnonymousId: '',
        creatorUserId: session.user.id,
        teamId
      })
      return c.json(
        {
          ...board,
          team: board.teamId ? { id: board.teamId, name: options.teamStore.findTeam(board.teamId)?.name ?? '' } : null
        },
        201
      )
    }

    const anonymousId = resolveAnonymousId(c)
    const board = options.boardStore.createBoard({
      name: parsed.data.name,
      creatorAnonymousId: anonymousId,
      creatorUserId: null,
      teamId: null
    })
    return c.json({ ...board, team: null }, 201)
  })

  app.patch('/boards/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = updateBoardSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const board = options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can update this board')
    }

    const nextTeamId = parsed.data.teamId === undefined ? undefined : (parsed.data.teamId?.trim() || null)
    if (nextTeamId) {
      const session = await getAuthSession(options.auth, c.req.raw)
      if (!session) return unauthorizedResponse()
      const team = options.teamStore.findTeam(nextTeamId)
      if (!team) return notFoundResponse('team_not_found', 'Team not found')
      if (team.ownerUserId !== session.user.id) {
        return forbiddenResponse('Only the team owner can attach boards to this team')
      }
    }

    const updated = options.boardStore.updateBoard(board.id, { teamId: nextTeamId })
    if (!updated) return notFoundResponse('board_not_found', 'Board not found')

    return c.json({
      ...updated,
      team: updated.teamId
        ? { id: updated.teamId, name: options.teamStore.findTeam(updated.teamId)?.name ?? '' }
        : null
    })
  })

  app.delete('/boards/:id', async (c) => {
    const board = options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can delete this board')
    }

    options.boardStore.deleteBoard(board.id)
    return c.json({ deleted: true })
  })

  app.get('/boards/:id/invitations', async (c) => {
    const board = options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can view invitations')
    }

    return c.json({
      board: {
        ...board,
        team: board.teamId ? { id: board.teamId, name: options.teamStore.findTeam(board.teamId)?.name ?? '' } : null
      },
      invitations: options.invitationStore.listInvitationsByBoardId(board.id)
    })
  })

  app.delete('/boards/:id/invitations/:invitationId', async (c) => {
    const board = options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can revoke invitations')
    }

    const invitationId = c.req.param('invitationId')
    const invitation = options.invitationStore.findInvitation(invitationId)
    if (!invitation || invitation.boardId !== board.id) {
      return notFoundResponse('invitation_not_found', 'Invitation not found')
    }

    return c.json({ invitation: options.invitationStore.revokeInvitation(invitationId) })
  })

  return app
}
