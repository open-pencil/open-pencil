import { Hono } from 'hono'
import { z } from 'zod'

import { resolveAnonymousId } from '../anonymousId.js'
import { getAuthSession, type InklyAuth } from '../auth/index.js'
import { isBoardOwner, resolveRequestActor } from '../auth/actor.js'
import type { BoardRecord, BoardStore, InvitationStore, TeamStore } from '../types.js'

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

async function attachTeamSummaries(
  boards: BoardRecord[],
  teamStore: TeamStore
) {
  const teamIds = [
    ...new Set(boards.map((board) => board.teamId).filter((teamId): teamId is string => !!teamId))
  ]
  const teamsById = new Map(
    await Promise.all(
      teamIds.map(async (teamId) => {
        const team = await teamStore.findTeam(teamId)
        return [teamId, team ? { id: team.id, name: team.name } : null] as const
      })
    )
  )

  return boards.map((board) => ({
    ...board,
    team: board.teamId ? (teamsById.get(board.teamId) ?? null) : null
  }))
}

function mergeBoards(
  personalBoards: BoardRecord[],
  teamBoards: BoardRecord[]
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
      const boards = await options.boardStore.listBoardsForAnonymous(anonymousId)
      return c.json({ boards: await attachTeamSummaries(boards, options.teamStore) })
    }

    const memberships = await options.teamStore.listTeamsForUser(session.user.id)
    const personalBoards = await options.boardStore.listBoardsForUser(session.user.id)
    const teamBoards = (
      await Promise.all(
        memberships.map((membership) => options.boardStore.listBoardsForTeam(membership.team.id))
      )
    ).flat()

    return c.json({
      boards: await attachTeamSummaries(mergeBoards(personalBoards, teamBoards), options.teamStore)
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
      const team = await options.teamStore.findTeam(teamId)
      if (!team) return notFoundResponse('team_not_found', 'Team not found')
      if (team.ownerUserId !== session.user.id) {
        return forbiddenResponse('Only the team owner can create team boards')
      }
    }

    if (session) {
      const board = await options.boardStore.createBoard({
        name: parsed.data.name,
        creatorAnonymousId: '',
        creatorUserId: session.user.id,
        teamId
      })
      const team = board.teamId ? await options.teamStore.findTeam(board.teamId) : null
      return c.json(
        {
          ...board,
          team: board.teamId ? { id: board.teamId, name: team?.name ?? '' } : null
        },
        201
      )
    }

    const anonymousId = resolveAnonymousId(c)
    const board = await options.boardStore.createBoard({
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

    const board = await options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can update this board')
    }

    const nextTeamId = parsed.data.teamId === undefined ? undefined : (parsed.data.teamId?.trim() || null)
    if (nextTeamId) {
      const session = await getAuthSession(options.auth, c.req.raw)
      if (!session) return unauthorizedResponse()
      const team = await options.teamStore.findTeam(nextTeamId)
      if (!team) return notFoundResponse('team_not_found', 'Team not found')
      if (team.ownerUserId !== session.user.id) {
        return forbiddenResponse('Only the team owner can attach boards to this team')
      }
    }

    const updated = await options.boardStore.updateBoard(board.id, { teamId: nextTeamId })
    if (!updated) return notFoundResponse('board_not_found', 'Board not found')

    const team = updated.teamId ? await options.teamStore.findTeam(updated.teamId) : null
    return c.json({
      ...updated,
      team: updated.teamId ? { id: updated.teamId, name: team?.name ?? '' } : null
    })
  })

  app.delete('/boards/:id', async (c) => {
    const board = await options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can delete this board')
    }

    await options.boardStore.deleteBoard(board.id)
    return c.json({ deleted: true })
  })

  app.get('/boards/:id/invitations', async (c) => {
    const board = await options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can view invitations')
    }

    const team = board.teamId ? await options.teamStore.findTeam(board.teamId) : null
    return c.json({
      board: {
        ...board,
        team: board.teamId ? { id: board.teamId, name: team?.name ?? '' } : null
      },
      invitations: await options.invitationStore.listInvitationsByBoardId(board.id)
    })
  })

  app.delete('/boards/:id/invitations/:invitationId', async (c) => {
    const board = await options.boardStore.findBoard(c.req.param('id'))
    if (!board) return notFoundResponse('board_not_found', 'Board not found')

    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    if (!isBoardOwner(board, actor)) {
      return forbiddenResponse('Only the creator can revoke invitations')
    }

    const invitationId = c.req.param('invitationId')
    const invitation = await options.invitationStore.findInvitation(invitationId)
    if (!invitation || invitation.boardId !== board.id) {
      return notFoundResponse('invitation_not_found', 'Invitation not found')
    }

    return c.json({ invitation: await options.invitationStore.revokeInvitation(invitationId) })
  })

  return app
}
