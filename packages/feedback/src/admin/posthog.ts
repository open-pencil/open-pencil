import type { MetricsQuery, MetricsUsage, RankedCount } from '#feedback/contract'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { groupBy, orderBy } from 'es-toolkit'
import * as v from 'valibot'

const QUERY_TIMEOUT_MS = 20_000

const usageRowSchema = v.tuple([v.string(), v.string(), v.number()])
const retentionRowSchema = v.tuple([v.string(), v.number(), v.number()])

/**
 * The range's days as SQL date literals. Both are validated `YYYY-MM-DD` strings by the time
 * they get here (`MetricsQuerySchema`), so nothing else can reach the query text.
 */
const dayRange = ({ start, end }: MetricsQuery, column = 'toDate(timestamp)') =>
  `${column} >= toDate('${start}') AND ${column} <= toDate('${end}')`

/** Installs per day and in all, then documents, exports, and AI replies by kind. */
function usageQuery(range: MetricsQuery) {
  const inRange = dayRange(range)
  const counted = (event: string, property: string) =>
    `SELECT '${event}', toString(properties.${property}), count() FROM events WHERE event = '${event}' AND ${inRange} GROUP BY properties.${property}`
  return [
    `SELECT 'installs', toString(toDate(timestamp)) AS day, count(DISTINCT distinct_id) FROM events WHERE event = 'app_opened' AND ${inRange} GROUP BY day`,
    `SELECT 'unique', '', count(DISTINCT distinct_id) FROM events WHERE event = 'app_opened' AND ${inRange}`,
    counted('document_opened', 'format'),
    counted('document_exported', 'format'),
    counted('ai_reply_finished', 'provider')
  ].join('\nUNION ALL ')
}

/** For installs first seen in the range, how many opened the app again each day after. */
function retentionQuery(range: MetricsQuery) {
  return `SELECT toString(f.first_day), dateDiff('day', f.first_day, toDate(e.timestamp)) AS n, count(DISTINCT e.distinct_id)
FROM events e
INNER JOIN (SELECT distinct_id, min(toDate(timestamp)) AS first_day FROM events WHERE event = 'app_opened' GROUP BY distinct_id) AS f ON e.distinct_id = f.distinct_id
WHERE e.event = 'app_opened' AND ${dayRange(range, 'f.first_day')}
GROUP BY f.first_day, n`
}

const ranked = (rows: [string, string, number][]): RankedCount[] =>
  orderBy(
    rows.map(([, name, value]) => ({ name: name || 'unknown', value })),
    ['value'],
    ['desc']
  )

/**
 * Asks PostHog over its query API with a personal key that can only read queries. The project
 * runs at most three queries at once, so the two run one after the other.
 */
export async function fetchUsage(
  env: FeedbackBindings,
  services: FeedbackServices,
  range: MetricsQuery
): Promise<MetricsUsage> {
  async function query<T extends v.GenericSchema>(
    sql: string,
    row: T
  ): Promise<v.InferOutput<T>[]> {
    const response = await services.fetch(
      `${env.POSTHOG_APP_HOST}/api/projects/${env.POSTHOG_PROJECT_ID}/query/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.POSTHOG_PERSONAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS)
      }
    )
    if (!response.ok) throw new Error(`PostHog answered ${response.status}`)
    const schema = v.pipe(v.string(), v.parseJson(), v.object({ results: v.array(row) }))
    const parsed = v.safeParse(schema, await response.text())
    if (!parsed.success) throw new Error('PostHog sent an unexpected answer')
    return parsed.output.results
  }

  const usage = await query(usageQuery(range), usageRowSchema)
  const retention = await query(retentionQuery(range), retentionRowSchema)
  // A kind with no events has no rows at all, so rows are picked by kind rather than looked up.
  const rowsOf = (kind: string) => usage.filter(([rowKind]) => rowKind === kind)
  const cohorts = Object.entries(groupBy(retention, ([cohort]) => cohort))
  return {
    installs: rowsOf('unique').at(0)?.[2] ?? 0,
    daily: orderBy(
      rowsOf('installs').map(([, day, installs]) => ({ day, installs })),
      ['day'],
      ['asc']
    ),
    retention: cohorts
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([cohort, rows]) => {
        const counts = new Map(rows.map(([, day, installs]) => [day, installs]))
        const last = Math.max(...counts.keys())
        return {
          cohort,
          values: Array.from({ length: last + 1 }, (_, day) => counts.get(day) ?? 0)
        }
      }),
    documents: ranked(rowsOf('document_opened')),
    exports: ranked(rowsOf('document_exported')),
    aiProviders: ranked(rowsOf('ai_reply_finished'))
  }
}
