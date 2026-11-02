import { REPORT_FILE_RETENTION_DAYS } from '#feedback/contract'
import type { ReportsBucket } from '#feedback/env'

const PREFIX = 'reports/'
const DAY_MS = 24 * 60 * 60 * 1000

/** Where a report's attached file lives in the bucket. */
export function reportFileKey(reportId: string, name: string): string {
  return `${PREFIX}${reportId}/${name}`
}

/** Deletes attached files older than `REPORT_FILE_RETENTION_DAYS`, as the privacy page promises. */
export async function deleteExpiredReportFiles(bucket: ReportsBucket, now: Date): Promise<number> {
  const cutoff = now.getTime() - REPORT_FILE_RETENTION_DAYS * DAY_MS
  let deleted = 0
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor })
    const expired = page.objects
      .filter((object) => object.uploaded.getTime() < cutoff)
      .map((object) => object.key)
    if (expired.length > 0) await bucket.delete(expired)
    deleted += expired.length
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return deleted
}
