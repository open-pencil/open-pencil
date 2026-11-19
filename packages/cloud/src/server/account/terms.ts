import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

/** Whether an account accepted the deployment's current terms, and recording that it did. */
export type TermsService = {
  /** The version accounts accept, when the deployment requires acceptance. */
  readonly requiredVersion: string | undefined
  /** True when nothing is required, or the account accepted the current version. */
  hasAccepted(userId: string): Promise<boolean>
  /** Records acceptance of the current version; false when `version` is not the current one. */
  accept(userId: string, version: string): Promise<boolean>
}

export function createTermsService(
  database: Kysely<CloudDatabase>,
  config: CloudServerConfig
): TermsService {
  const requiredVersion = config.legal?.requireAcceptance ? config.legal.termsVersion : undefined
  return {
    requiredVersion,
    async hasAccepted(userId) {
      if (!requiredVersion) return true
      const row = await database
        .selectFrom('termsAcceptance')
        .select('userId')
        .where('userId', '=', userId)
        .where('version', '=', requiredVersion)
        .executeTakeFirst()
      return row !== undefined
    },
    async accept(userId, version) {
      if (!requiredVersion || version !== requiredVersion) return false
      await database
        .insertInto('termsAcceptance')
        .values({ userId, version, acceptedAt: new Date() })
        .onConflict((conflict) => conflict.columns(['userId', 'version']).doNothing())
        .execute()
      return true
    }
  }
}
