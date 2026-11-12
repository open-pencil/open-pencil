import type { CloudDatabase } from '#cloud/server/db'
import { INVITATION_BUDGET } from '#cloud/server/invitations'
import type { Kysely } from 'kysely'

export function createRateLimitCleanupService(database: Kysely<CloudDatabase>) {
  return {
    async cleanupExpired(before: Date): Promise<number> {
      const [limits, invitations] = await Promise.all([
        database
          .deleteFrom('apiRateLimit')
          .where('windowStartedAt', '<', before)
          .executeTakeFirst(),
        // Never a send the invitation budget still counts, whatever cutoff the sweep passes.
        database
          .deleteFrom('invitationSend')
          .where(
            'sentAt',
            '<',
            new Date(Math.min(before.getTime(), Date.now() - INVITATION_BUDGET.windowMs))
          )
          .executeTakeFirst()
      ])
      return Number(limits.numDeletedRows) + Number(invitations.numDeletedRows)
    }
  }
}

export type RateLimitCleanupService = ReturnType<typeof createRateLimitCleanupService>
