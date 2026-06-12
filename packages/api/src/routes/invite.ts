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

const redeemRequestSchema = z.object({
  token: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(['signUp', 'signIn']).optional()
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

  /**
   * 招待 redeem endpoint。
   *
   * 招待された email を使い、 password を設定 (signUp) または既存 password で sign-in
   * して、 board の collaborator として user.id を紐付ける。 better-auth の
   * /sign-up/email / /sign-in/email を server 内部から叩いて Set-Cookie を取得し、
   * そのまま response headers に転写することで session を caller に渡す。
   */
  app.post('/invite/redeem', async (c) => {
    const anonymousId = resolveAnonymousId(c)
    const body = await c.req.json().catch(() => null)
    const parsed = redeemRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(validationError(issue), 400)
    }

    // 1) 招待 token を検証
    const verification = await verifyInvitationToken(parsed.data.token, options.secret)
    if (!verification.valid) {
      return c.json({ error: { code: verification.reason, message: 'Invitation token is invalid' } }, 401)
    }
    const invitation = await options.store.findInvitation(verification.payload.sub)
    if (!invitation || invitation.revoked || invitation.jti !== verification.payload.jti) {
      return c.json({ error: { code: 'revoked', message: 'Invitation has been revoked' } }, 401)
    }
    if (invitation.expiresAt <= now()) {
      return c.json({ error: { code: 'expired', message: 'Invitation has expired' } }, 401)
    }

    // 2) email hash 照合 (招待された email と redeem 入力 email が一致するか)
    const inputEmailHash = await hashInvitationEmail(parsed.data.email)
    if (inputEmailHash !== invitation.sentToEmailHash) {
      return c.json(
        { error: { code: 'email_mismatch', message: 'Email does not match invitation' } },
        403
      )
    }

    // 3) better-auth で signUp または signIn
    if (!options.auth.signUpWithEmail || !options.auth.signInWithEmail) {
      return c.json(
        { error: { code: 'auth_misconfigured', message: 'Email/password auth not available' } },
        500
      )
    }

    const requestedMode = parsed.data.mode ?? 'signUp'
    let credential
    try {
      if (requestedMode === 'signUp') {
        credential = await options.auth.signUpWithEmail({
          email: parsed.data.email,
          password: parsed.data.password,
          name: parsed.data.name ?? parsed.data.email
        })
      } else {
        credential = await options.auth.signInWithEmail({
          email: parsed.data.email,
          password: parsed.data.password
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed'
      const code = requestedMode === 'signUp' ? 'sign_up_failed' : 'sign_in_failed'
      return c.json({ error: { code, message } }, 400)
    }

    // 4) board collaborator として user.id を紐付け
    if (options.boardStore) {
      await options.boardStore.addCollaborator(invitation.boardId, {
        anonymousId,
        userId: credential.userId,
        role: invitation.role,
        invitationId: invitation.id
      })
    }

    // 5) Set-Cookie を response に転写して session を caller に渡す
    const responseInit: ResponseInit = { status: 200 }
    if (credential.setCookieHeader) {
      responseInit.headers = { 'set-cookie': credential.setCookieHeader }
    }
    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: credential.userId, email: credential.email, name: credential.name },
        invitation: {
          id: invitation.id,
          boardId: invitation.boardId,
          role: invitation.role
        }
      }),
      {
        ...responseInit,
        headers: {
          'content-type': 'application/json',
          ...(responseInit.headers ?? {})
        }
      }
    )
  })

  return app
}
