import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings } from '#feedback/env'
import { deleteExpiredReportFiles } from '#feedback/reports/files'
import { deleteUnconfirmedSignups } from '#feedback/waitlist/signup'

/**
 * The daily cron: drops what the privacy page says we do not keep, unconfirmed sign-ups and old
 * report files. Ping counts hold no personal data and stay.
 */
export async function runRetention(env: FeedbackBindings, now: Date): Promise<void> {
  // Each cleanup runs whether or not the other fails; the first failure is still thrown.
  const results = await Promise.allSettled([
    deleteUnconfirmedSignups(createFeedbackDatabase(env.DB), now),
    deleteExpiredReportFiles(env.REPORTS, now)
  ])
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
}
