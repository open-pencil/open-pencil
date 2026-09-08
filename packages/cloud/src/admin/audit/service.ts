import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export function createAdminAuditService(database: Kysely<CloudDatabase>) {
  return {
    async list(limit = 100) {
      return database
        .selectFrom('cloudAdminAuditEvent')
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(Math.min(Math.max(limit, 1), 500))
        .execute()
    }
  }
}

export type AdminAuditService = ReturnType<typeof createAdminAuditService>
