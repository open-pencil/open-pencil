import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export function createRateLimitCleanupService(database: Kysely<CloudDatabase>) {
  return {
    async cleanupExpired(before: Date): Promise<number> {
      const [limits, invitations] = await Promise.all([
        database
          .deleteFrom('apiRateLimit')
          .where('windowStartedAt', '<', before)
          .executeTakeFirst(),
        // The invitation budget counts a day of sends, which the sweep passes `before` as.
        database.deleteFrom('invitationSend').where('sentAt', '<', before).executeTakeFirst()
      ])
      return Number(limits.numDeletedRows) + Number(invitations.numDeletedRows)
    }
  }
}

export type RateLimitCleanupService = ReturnType<typeof createRateLimitCleanupService>
