import type { CloudMFAStatus } from '#cloud/server/auth/adapter'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

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
        .insertInto('cloudMfaAssurance')
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
        .selectFrom('cloudMfaAssurance')
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
        assured,
        totpAvailable: config.totpEnabled,
        passkeysAvailable: config.passkeysEnabled,
        recoveryCodesAvailable: config.totpEnabled && config.recoveryCodesEnabled
      }
    }
  }
}

export type MFAAssuranceService = ReturnType<typeof createMFAAssuranceService>
