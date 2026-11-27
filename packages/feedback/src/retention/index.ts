import type { FeedbackBindings } from '#feedback/env'
import { deleteExpiredReportFiles } from '#feedback/reports/files'

/**
 * The daily cron: drops what the privacy page says we do not keep, report files past their
 * retention. Ping counts hold no personal data and stay.
 */
export async function runRetention(env: FeedbackBindings, now: Date): Promise<void> {
  await deleteExpiredReportFiles(env.REPORTS, now)
}
