import type { MetricsQuery } from '#feedback/contract'
import type { FeedbackDatabase } from '#feedback/db'
import { orderBy } from 'es-toolkit'
import type { Kysely } from 'kysely'

/** npm downloads of every package each finished day of the range, and each package's in all. */
export async function npmDownloads(
  db: Kysely<FeedbackDatabase>,
  range: MetricsQuery,
  days: string[]
) {
  const inRange = db
    .selectFrom('npmDownloads')
    .where('day', '>=', range.start)
    .where('day', '<=', range.end)
  const [byDay, byPackage] = await Promise.all([
    inRange
      .select(['day', (eb) => eb.fn.sum<number>('downloads').as('downloads')])
      .groupBy('day')
      .execute(),
    inRange
      .select(['package', (eb) => eb.fn.sum<number>('downloads').as('downloads')])
      .groupBy('package')
      .execute()
  ])
  if (!byPackage.length) return { daily: [], packages: [] }
  const counted = new Map(byDay.map((row) => [row.day, Number(row.downloads)]))
  return {
    daily: days.map((day) => ({ day, downloads: counted.get(day) ?? 0 })),
    packages: orderBy(
      byPackage.map((row) => ({ name: row.package, value: Number(row.downloads) })),
      ['value', 'name'],
      ['desc', 'asc']
    )
  }
}
