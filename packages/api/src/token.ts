import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'

import {
  INVITATION_ISSUER,
  INVITATION_ROLES,
  type InvitationPayload,
  type InvitationVerifyFailureReason
} from './types.js'

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60

export const INVITATION_TTL_MS = SEVEN_DAYS_IN_SECONDS * 1000

const invitationPayloadSchema = z.object({
  iss: z.literal(INVITATION_ISSUER),
  sub: z.string().min(1),
  board_id: z.string().min(1),
  role: z.enum(INVITATION_ROLES),
  email_hash: z.string().regex(/^[0-9a-f]{64}$/),
  exp: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  jti: z.string().uuid()
})

const textEncoder = new TextEncoder()

export interface VerifiedInvitationToken {
  valid: true
  payload: InvitationPayload
}

export interface InvalidInvitationToken {
  valid: false
  reason: InvitationVerifyFailureReason
}

export type InvitationTokenVerificationResult = VerifiedInvitationToken | InvalidInvitationToken

function secretKey(secret: string): Uint8Array {
  return textEncoder.encode(secret)
}

export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.INKLY_API_JWT_SECRET?.trim()
  if (!secret) {
    throw new Error('INKLY_API_JWT_SECRET is required')
  }
  return secret
}

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.INKLY_API_JWT_SECRET?.trim()
  if (secret) {
    return secret
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('INKLY_API_JWT_SECRET is required')
  }

  process.stderr.write(
    '[inkly-api] INKLY_API_JWT_SECRET is not set; using an insecure local development secret.\n'
  )
  return 'inkly-local-development-secret-for-auth'
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function hashInvitationEmail(email: string): Promise<string> {
  const normalizedEmail = normalizeInvitationEmail(email)
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(normalizedEmail))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function signInvitationToken(
  payload: InvitationPayload,
  secret: string
): Promise<string> {
  return new SignJWT({
    board_id: payload.board_id,
    role: payload.role,
    email_hash: payload.email_hash
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(payload.iss)
    .setSubject(payload.sub)
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setJti(payload.jti)
    .sign(secretKey(secret))
}

export async function verifyInvitationToken(
  token: string,
  secret: string
): Promise<InvitationTokenVerificationResult> {
  if (!token.trim()) {
    return { valid: false, reason: 'malformed' }
  }

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ['HS256'],
      issuer: INVITATION_ISSUER
    })

    const parsed = invitationPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return { valid: false, reason: 'malformed' }
    }

    return {
      valid: true,
      payload: parsed.data
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'JWTExpired') {
      return { valid: false, reason: 'expired' }
    }
    if (name === 'JWSSignatureVerificationFailed') {
      return { valid: false, reason: 'invalid_signature' }
    }
    return { valid: false, reason: 'malformed' }
  }
}
