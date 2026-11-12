import { REPORT_FILE_RETENTION_DAYS } from '#feedback/contract'
import type { ReportsBucket } from '#feedback/env'

import { extractFigThumbnailFromReader } from '@open-pencil/fig'

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

/**
 * The thumbnail an attached `.fig` carries, read from the bucket in ranges so a large document is
 * never fetched whole; null when the file is gone or carries none.
 */
export async function reportFileThumbnail(
  bucket: ReportsBucket,
  key: string
): Promise<Uint8Array | null> {
  const head = await bucket.head(key)
  if (!head) return null
  return extractFigThumbnailFromReader({
    size: head.size,
    async read(start, endExclusive) {
      const object = await bucket.get(key, {
        range: { offset: start, length: endExclusive - start }
      })
      if (!object) throw new Error('The attached file went away while it was read')
      return new Uint8Array(await object.arrayBuffer())
    }
  }).catch(() => null)
}
