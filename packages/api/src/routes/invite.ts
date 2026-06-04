import { Hono } from 'hono'
import { z } from 'zod'

import { resolveAnonymousId } from '../anonymousId.js'
import {
  hashInvitationEmail,
  INVITATION_TTL_MS,
  signInvitationToken,
  verifyInvitationToken
} from '../token.js'
import {
  INVITATION_ISSUER,
  INVITATION_ROLES,
  type BoardStore,
  type InvitationPayload,
  type InvitationStore
} from '../types.js'

const inviteRequestSchema = z.object({
  email: z.string().trim().email(),
  boardId: z.string().trim().min(1),
  role: z.enum(INVITATION_ROLES)
})

const verifyRequestSchema = z.object({
  token: z.string().trim().min(1)
})

interface ValidationErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface InviteRoutesOptions {
  secret: string
  store: InvitationStore
  boardStore?: BoardStore
  now?: () => number
}

function validationError(message: string): ValidationErrorBody {
  return {
    error: {
      code: 'invalid_request_body',
      message
    }
  }
}

export function createInviteRoutes(options: InviteRoutesOptions): Hono {
  const app = new Hono()
  const now = options.now ?? Date.now

  app.post('/invite', async (c) => {
    const anonymousId = resolveAnonymousId(c)
    const body = await c.req.json().catch(() => null)
    const parsed = inviteRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const board = options.boardStore?.findBoard(parsed.data.boardId)
    if (board && board.creatorAnonymousId !== anonymousId) {
      return c.json(
        {
          error: {
            code: 'forbidden',
            message: 'Only the creator can invite collaborators'
          }
        },
        403
      )
    }

    const issuedAt = now()
    const expiresAt = issuedAt + INVITATION_TTL_MS
    const sentToEmailHash = await hashInvitationEmail(parsed.data.email)
    const invitation = options.store.createInvitation({
      boardId: parsed.data.boardId,
      sentToEmailHash,
      role: parsed.data.role,
      expiresAt
    })

    const payload: InvitationPayload = {
      iss: INVITATION_ISSUER,
      sub: invitation.id,
      board_id: invitation.boardId,
      role: invitation.role,
      email_hash: invitation.sentToEmailHash,
      exp: Math.floor(invitation.expiresAt / 1000),
      iat: Math.floor(issuedAt / 1000),
      jti: invitation.jti
    }

    const token = await signInvitationToken(payload, options.secret)
    options.store.attachInvitationToken(invitation.id, token)

    return c.json(
      {
        invitationId: invitation.id,
        token,
        expiresAt: invitation.expiresAt,
        url: `/invite/${token}`
      },
      201
    )
  })

  app.post('/invite/verify', async (c) => {
    const anonymousId = resolveAnonymousId(c)
    const body = await c.req.json().catch(() => null)
    const parsed = verifyRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const verification = await verifyInvitationToken(parsed.data.token, options.secret)
    if (!verification.valid) {
      return c.json(
        {
          valid: false,
          reason: verification.reason
        },
        401
      )
    }

    const invitation = options.store.findInvitation(verification.payload.sub)
    if (!invitation || invitation.revoked || invitation.jti !== verification.payload.jti) {
      // Missing in-memory records are treated as revoked because Phase A storage is process-local.
      return c.json(
        {
          valid: false,
          reason: 'revoked'
        },
        401
      )
    }

    if (invitation.expiresAt <= now()) {
      return c.json(
        {
          valid: false,
          reason: 'expired'
        },
        401
      )
    }

    options.boardStore?.addCollaborator(invitation.boardId, {
      anonymousId,
      role: invitation.role,
      invitationId: invitation.id
    })

    return c.json({
      valid: true,
      invitation: {
        id: invitation.id,
        boardId: invitation.boardId,
        role: invitation.role,
        expiresAt: invitation.expiresAt
      }
    })
  })

  return app
}
