import { Hono } from 'hono'
import { z } from 'zod'

import { getInviterAnonymousLabel, resolveAnonymousId } from '../anonymousId.js'
import { isBoardOwner, resolveRequestActor } from '../auth/actor.js'
import { getAuthSession, type InklyAuth } from '../auth/index.js'
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
  type InvitationStore,
  type NotificationStore
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
  auth: InklyAuth
  secret: string
  store: InvitationStore
  boardStore?: BoardStore
  notificationStore?: NotificationStore
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
    const session = await getAuthSession(options.auth, c.req.raw)
    const actor = await resolveRequestActor(options.auth, c.req.raw, () => resolveAnonymousId(c))
    const body = await c.req.json().catch(() => null)
    const parsed = inviteRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    const board = options.boardStore ? await options.boardStore.findBoard(parsed.data.boardId) : null
    if (board && !isBoardOwner(board, actor)) {
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
    const invitation = await options.store.createInvitation({
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
    await options.store.attachInvitationToken(invitation.id, token)
    const relativeUrl = `/invite/${token}`
    const invitationUrl = new URL(relativeUrl, c.req.url).toString()
    const recipientUser = options.notificationStore
      ? await options.notificationStore.findUserByEmail(parsed.data.email)
      : null

    if (recipientUser && options.notificationStore) {
      await options.notificationStore.createNotification({
        userId: recipientUser.id,
        type: 'invitation',
        payload: {
          invitationId: invitation.id,
          boardId: invitation.boardId,
          boardName: board?.name ?? 'Untitled board',
          role: invitation.role,
          inviterDisplayName:
            session?.user.name?.trim() ||
            session?.user.email ||
            getInviterAnonymousLabel(actor.anonymousId ?? ''),
          inviteeEmail: recipientUser.email,
          url: relativeUrl
        }
      })
    }

    return c.json(
      {
        invitationId: invitation.id,
        token,
        expiresAt: invitation.expiresAt,
        url: relativeUrl
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

    const invitation = await options.store.findInvitation(verification.payload.sub)
    if (!invitation || invitation.revoked || invitation.jti !== verification.payload.jti) {
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

    if (options.boardStore) {
      await options.boardStore.addCollaborator(invitation.boardId, {
        anonymousId,
        role: invitation.role,
        invitationId: invitation.id
      })
    }

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
