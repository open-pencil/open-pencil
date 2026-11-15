import type { CloudMFAStatus } from '#cloud/server/auth/adapter'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { APIError } from 'better-auth'
import type { Kysely } from 'kysely'

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
      method: 'totp' | 'recovery-code' | 'passkey'
    }): Promise<void> {
      await database
        .insertInto('mfaAssurance')
        .values({ ...input, verifiedAt: new Date() })
        .onConflict((conflict) =>
          conflict.column('sessionId').doUpdateSet({ method: input.method, verifiedAt: new Date() })
        )
        .execute()
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

/** Records the second step a response just signed in with, against the session it started. */
export async function recordResponseAssurance(
  response: Response,
  method: 'totp' | 'recovery-code' | 'passkey',
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService
): Promise<void> {
  const signedToken = response.headers.get('set-auth-token')
  const token = signedToken?.split('.', 1)[0]
  if (!token) return
  const session = await database
    .selectFrom('session')
    .select(['id', 'userId'])
    .where('token', '=', token)
    .executeTakeFirst()
  if (session) await assurance.record({ sessionId: session.id, userId: session.userId, method })
}

/**
 * Checks a second-step code through the two-step plugin's own endpoint, and records the session's
 * assurance when it passes.
 */
export async function verifySecondFactor(
  auth: { handler(request: Request): Promise<Response> },
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  assurance: MFAAssuranceService,
  headers: Headers,
  code: string,
  method: 'totp' | 'recovery-code',
  /** The two-step plugin's endpoint that checks this kind of code. */
  endpoint: { path: string }
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
  if (!response.ok) throw APIError.fromStatus(response.status as 401)
  await recordResponseAssurance(response, method, database, assurance)
  return response
}
