import type { CloudMFAStatus } from '#cloud/server/auth/adapter'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase, MFAAssuranceMethod } from '#cloud/server/db'
import { APIError } from 'better-auth'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import { authRequestPath } from './endpoints'

const ASSURANCE_MAX_AGE_MS = 12 * 60 * 60_000

export function createMFAAssuranceService(
  database: Kysely<CloudDatabase>,
  config: CloudServerConfig
) {
  return {
    async record(input: {
      sessionId: string
      userId: string
      method: MFAAssuranceMethod
    }): Promise<void> {
      await database
        .insertInto('mfaAssurance')
        .values({ ...input, verifiedAt: new Date() })
        .onConflict((conflict) =>
          conflict.column('sessionId').doUpdateSet({ method: input.method, verifiedAt: new Date() })
        )
        .execute()
    },
    /**
     * Whether a session may act as its account. One whose account has an authenticator or a
     * passkey must have proved it, at sign-in or since; a sign-in through a linked account such
     * as Google never asks for it. Unlike `status().assured`, the proof does not age.
     */
    async confirmed(input: {
      sessionId: string
      userId: string
      twoFactorEnabled: boolean
    }): Promise<boolean> {
      const row = await database
        .selectNoFrom((expression) => [
          expression
            .exists(
              expression
                .selectFrom('mfaAssurance')
                .select('mfaAssurance.sessionId')
                .where('mfaAssurance.sessionId', '=', input.sessionId)
                .where('mfaAssurance.userId', '=', input.userId)
            )
            .as('assured'),
          expression
            .exists(
              expression
                .selectFrom('passkey')
                .select('passkey.id')
                .where('passkey.userId', '=', input.userId)
            )
            .as('passkey')
        ])
        .executeTakeFirstOrThrow()
      if (row.assured) return true
      return !input.twoFactorEnabled && !row.passkey
    },
    async status(input: {
      sessionId: string
      userId: string
      deploymentRole?: 'user' | 'admin'
      twoFactorEnabled: boolean
      passkeyCount: number
    }): Promise<CloudMFAStatus> {
      const assurance = await database
        .selectFrom('mfaAssurance')
        .select('verifiedAt')
        .where('sessionId', '=', input.sessionId)
        .where('userId', '=', input.userId)
        .executeTakeFirst()
      const assured = Boolean(
        assurance && new Date(assurance.verifiedAt).getTime() > Date.now() - ASSURANCE_MAX_AGE_MS
      )
      return {
        required: config.deploymentAdminMFARequired && input.deploymentRole === 'admin' && !assured,
        enabled: input.twoFactorEnabled || input.passkeyCount > 0,
        totpEnabled: input.twoFactorEnabled,
        assured,
        totpAvailable: config.totpEnabled,
        passkeysAvailable: config.passkeysEnabled,
        recoveryCodesAvailable: config.totpEnabled && config.recoveryCodesEnabled
      }
    }
  }
}

export type MFAAssuranceService = ReturnType<typeof createMFAAssuranceService>

/**
 * Records the second step a response just signed in with, against the session it started; false
 * when it started none.
 */
export async function recordResponseAssurance(
  response: Response,
  method: MFAAssuranceMethod,
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService
): Promise<boolean> {
  const signedToken = response.headers.get('set-auth-token')
  const token = signedToken?.split('.', 1)[0]
  if (!token) return false
  const session = await database
    .selectFrom('session')
    .select(['id', 'userId'])
    .where('token', '=', token)
    .executeTakeFirst()
  if (!session) return false
  await assurance.record({ sessionId: session.id, userId: session.userId, method })
  return true
}

const deviceTokenSchema = v.pipe(v.string(), v.parseJson(), v.object({ access_token: v.string() }))

/** Records a desktop app's new session from a device sign-in, whose approval proved the step. */
export async function recordDeviceAssurance(
  response: Response,
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService
): Promise<void> {
  const body = v.safeParse(deviceTokenSchema, await response.clone().text())
  if (!body.success) return
  const session = await database
    .selectFrom('session')
    .select(['id', 'userId'])
    .where('token', '=', body.output.access_token)
    .executeTakeFirst()
  if (session) {
    await assurance.record({ sessionId: session.id, userId: session.userId, method: 'device' })
  }
}

/** The auth endpoints whose success proves a second step, by their request paths. */
export type ProofPaths = {
  totp: string
  recoveryCode: string
  passkeySignIn: string
  passkeyRegistration: string
  deviceToken: string
}

/**
 * Records what a successful auth response proved. Signing in with a code, a recovery code, or a
 * passkey proves it for the session it starts; a device sign-in proves it for the app's session,
 * since only a proved session may approve one; registering a passkey proves it for the session
 * that added it, maybe the account's first second step, so that session is not then held.
 */
export function createProofRecorder(
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService,
  paths: ProofPaths
) {
  const signIns = new Map<string, MFAAssuranceMethod>([
    [paths.totp, 'totp'],
    [paths.recoveryCode, 'recovery-code'],
    [paths.passkeySignIn, 'passkey']
  ])
  return async (
    path: string,
    response: Response,
    /** The session the request came from, read only when the step is proved for it. */
    current: () => Promise<{ session: { id: string }; user: { id: string } } | null>
  ): Promise<void> => {
    const method = signIns.get(path)
    if (method) await recordResponseAssurance(response, method, database, assurance)
    else if (path === paths.deviceToken) await recordDeviceAssurance(response, database, assurance)
    else if (path === paths.passkeyRegistration) {
      const session = await current()
      if (session) {
        await assurance.record({
          sessionId: session.session.id,
          userId: session.user.id,
          method: 'passkey'
        })
      }
    }
  }
}

/**
 * Checks a second-step code through the two-step plugin's own endpoint, and records the session's
 * assurance when it passes.
 */
/** Better Auth's words for a code that does not match. */
const WRONG_CODES = new Set(['INVALID_CODE', 'INVALID_TWO_FACTOR_CODE', 'INVALID_BACKUP_CODE'])
const authErrorSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ code: v.optional(v.string()) })
)

export async function verifySecondFactor(
  auth: { handler(request: Request): Promise<Response> },
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService,
  headers: Headers,
  code: string,
  method: 'totp' | 'recovery-code',
  /** The two-step plugin's endpoint that checks this kind of code. */
  endpoint: { path: string },
  /** The session the code is checked for, which proves the step when it is not replaced. */
  current: { id: string; userId: string } | null
): Promise<Response> {
  const response = await auth.handler(
    new Request(new URL(authRequestPath(endpoint.path), config.publicURL), {
      method: 'POST',
      headers: new Headers({
        ...Object.fromEntries(headers),
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ code, trustDevice: false })
    })
  )
  if (!response.ok) {
    // A wrong code is the person's mistake, not a session to renew: say so, as a 400.
    const answer = v.safeParse(authErrorSchema, await response.clone().text())
    if (answer.success && WRONG_CODES.has(answer.output.code ?? '')) {
      throw new APIError('BAD_REQUEST', { code: 'INVALID_CODE' })
    }
    throw APIError.fromStatus(response.status as 401)
  }
  // A session whose account already has the step proves it without being replaced: it is the one
  // that proved it. Turning an authenticator on replaces the session, and the new one is recorded.
  const recorded = await recordResponseAssurance(response, method, database, assurance)
  if (!recorded && current) {
    await assurance.record({ sessionId: current.id, userId: current.userId, method })
  }
  return response
}
