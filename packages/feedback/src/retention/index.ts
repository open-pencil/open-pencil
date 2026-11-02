import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings } from '#feedback/env'
import { deleteExpiredReportFiles } from '#feedback/reports/files'
import { deleteUnconfirmedSignups } from '#feedback/waitlist/signup'

/**
 * The daily cron: drops what the privacy page says we do not keep, unconfirmed sign-ups and old
 * report files. Ping counts hold no personal data and stay.
 */
export async function runRetention(env: FeedbackBindings, now: Date): Promise<void> {
  await deleteUnconfirmedSignups(createFeedbackDatabase(env.DB), now)
  await deleteExpiredReportFiles(env.REPORTS, now)
}
