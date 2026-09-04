import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export function createRateLimitCleanupService(database: Kysely<CloudDatabase>) {
  return {
    async cleanupExpired(before: Date): Promise<number> {
      const result = await database
        .deleteFrom('cloudRateLimit')
        .where('windowStartedAt', '<', before)
        .executeTakeFirst()
      return Number(result.numDeletedRows)
    }
  }
}

export type RateLimitCleanupService = ReturnType<typeof createRateLimitCleanupService>
