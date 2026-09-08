import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export function createAdminOperationsService(
  database: Kysely<CloudDatabase>,
  config: CloudServerConfig
) {
  async function emailCount(status: 'pending' | 'failed'): Promise<number> {
    const row = await database
      .selectFrom('transactionalEmail')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('status', '=', status)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return {
    async summary() {
      const [pendingEnrollment, pendingEmail, failedEmail] = await Promise.all([
        database
          .selectFrom('cloudEnrollment')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .where('status', '=', 'pending')
          .executeTakeFirstOrThrow(),
        emailCount('pending'),
        emailCount('failed')
      ])
      return {
        deployment: config.deployment,
        enrollmentMode: config.enrollmentMode,
        emailTransport: config.emailTransport,
        pendingEnrollment: Number(pendingEnrollment.count),
        pendingEmail,
        failedEmail
      }
    }
  }
}

export type AdminOperationsService = ReturnType<typeof createAdminOperationsService>
