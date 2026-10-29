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
      const [
        pendingEnrollment,
        pendingEmail,
        failedEmail,
        accounts,
        workspaces,
        documents,
        stored
      ] = await Promise.all([
        database
          .selectFrom('enrollment')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .where('status', '=', 'pending')
          .executeTakeFirstOrThrow(),
        emailCount('pending'),
        emailCount('failed'),
        database
          .selectFrom('user')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('workspace')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('document')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .where('deletedAt', 'is', null)
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('workspaceStorageUsage')
          .select(({ fn }) => fn.sum<number | null>('committedBytes').as('bytes'))
          .executeTakeFirstOrThrow()
      ])
      return {
        deployment: config.deployment,
        enrollmentMode: config.enrollmentMode,
        emailTransport: config.emailTransport,
        pendingEnrollment: Number(pendingEnrollment.count),
        pendingEmail,
        failedEmail,
        accounts: Number(accounts.count),
        workspaces: Number(workspaces.count),
        documents: Number(documents.count),
        storedBytes: Number(stored.bytes ?? 0)
      }
    }
  }
}

export type AdminOperationsService = ReturnType<typeof createAdminOperationsService>
