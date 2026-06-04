import { Hono } from 'hono'
import { z } from 'zod'

import { resolveAnonymousId } from '../anonymousId.js'
import type { BoardStore, InvitationStore } from '../types.js'

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Untitled board')
})

interface ValidationErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface BoardRoutesOptions {
  boardStore: BoardStore
  invitationStore: InvitationStore
}

function validationError(message: string): ValidationErrorBody {
  return {
    error: {
      code: 'invalid_request_body',
      message
    }
  }
}

export function createBoardRoutes(options: BoardRoutesOptions): Hono {
  const app = new Hono()

  app.get('/boards', (c) => {
    const anonymousId = resolveAnonymousId(c)
    const boards = options.boardStore.listBoardsForAnonymous(anonymousId)
    return c.json({ boards })
  })

  app.post('/boards', async (c) => {
    const anonymousId = resolveAnonymousId(c)
    const body = await c.req.json().catch(() => ({}))
    const parsed = createBoardSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const board = options.boardStore.createBoard({
      name: parsed.data.name,
      creatorAnonymousId: anonymousId
    })
    return c.json(board, 201)
  })

  app.delete('/boards/:id', (c) => {
    const anonymousId = resolveAnonymousId(c)
    const id = c.req.param('id')
    const board = options.boardStore.findBoard(id)
    if (!board) {
      return c.json(
        {
          error: {
            code: 'board_not_found',
            message: 'Board not found'
          }
        },
        404
      )
    }
    if (board.creatorAnonymousId !== anonymousId) {
      return c.json(
        {
          error: {
            code: 'forbidden',
            message: 'Only the creator can delete this board'
          }
        },
        403
      )
    }
    options.boardStore.deleteBoard(id)
    return c.json({ deleted: true })
  })

  app.get('/boards/:id/invitations', (c) => {
    const anonymousId = resolveAnonymousId(c)
    const id = c.req.param('id')
    const board = options.boardStore.findBoard(id)
    if (!board) {
      return c.json(
        {
          error: {
            code: 'board_not_found',
            message: 'Board not found'
          }
        },
        404
      )
    }
    if (board.creatorAnonymousId !== anonymousId) {
      return c.json(
        {
          error: {
            code: 'forbidden',
            message: 'Only the creator can view invitations'
          }
        },
        403
      )
    }

    return c.json({
      board,
      invitations: options.invitationStore.listInvitationsByBoardId(id)
    })
  })

  app.delete('/boards/:id/invitations/:invitationId', (c) => {
    const anonymousId = resolveAnonymousId(c)
    const id = c.req.param('id')
    const invitationId = c.req.param('invitationId')
    const board = options.boardStore.findBoard(id)
    if (!board) {
      return c.json(
        {
          error: {
            code: 'board_not_found',
            message: 'Board not found'
          }
        },
        404
      )
    }
    if (board.creatorAnonymousId !== anonymousId) {
      return c.json(
        {
          error: {
            code: 'forbidden',
            message: 'Only the creator can revoke invitations'
          }
        },
        403
      )
    }
    const invitation = options.invitationStore.findInvitation(invitationId)
    if (!invitation || invitation.boardId !== id) {
      return c.json(
        {
          error: {
            code: 'invitation_not_found',
            message: 'Invitation not found'
          }
        },
        404
      )
    }
    const revoked = options.invitationStore.revokeInvitation(invitationId)
    return c.json({ invitation: revoked })
  })

  return app
}
