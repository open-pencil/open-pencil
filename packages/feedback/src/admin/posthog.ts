import {
  CAMPAIGN_PLACEMENTS,
  DONATION_SOURCES,
  type MetricsQuery,
  type MetricsUsage,
  type RankedCount
} from '#feedback/contract'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { groupBy, orderBy } from 'es-toolkit'
import * as v from 'valibot'

import { maxOf } from '@open-pencil/std/arrays'
import { DEADLINE_MS } from '@open-pencil/std/timing'

const QUERY_TIMEOUT_MS = DEADLINE_MS.slowRequest

const usageRowSchema = v.tuple([v.string(), v.string(), v.number()])
const retentionRowSchema = v.tuple([v.string(), v.number(), v.number()])

/**
 * The range's days as SQL date literals. Both are validated `YYYY-MM-DD` strings by the time
 * they get here (`MetricsQuerySchema`), so nothing else can reach the query text.
 */
export const dayRange = ({ start, end }: MetricsQuery, column = 'toDate(timestamp)') =>
  `${column} >= toDate('${start}') AND ${column} <= toDate('${end}')`

const CAMPAIGN_EVENTS = ['campaign_shown', 'campaign_dismissed', 'campaign_acted'] as const

/**
 * Installs per day and in all, then documents, exports, and AI replies by kind, campaign events
 * by campaign and placement (IDs and placements have no spaces), and donation page openings.
 */
function usageQuery(range: MetricsQuery) {
  const inRange = dayRange(range)
  const counted = (event: string, property: string) =>
    `SELECT '${event}', toString(properties.${property}), count() FROM events WHERE event = '${event}' AND ${inRange} GROUP BY properties.${property}`
  return [
    `SELECT 'installs', toString(toDate(timestamp)) AS day, count(DISTINCT distinct_id) FROM events WHERE event = 'app_opened' AND ${inRange} GROUP BY day`,
    `SELECT 'unique', '', count(DISTINCT distinct_id) FROM events WHERE event = 'app_opened' AND ${inRange}`,
    counted('document_opened', 'format'),
    counted('document_exported', 'format'),
    counted('ai_reply_finished', 'provider'),
    ...CAMPAIGN_EVENTS.map(
      (event) =>
        `SELECT '${event}', concat(toString(properties.campaign), ' ', toString(properties.placement)) AS shown_in, count() FROM events WHERE event = '${event}' AND ${inRange} GROUP BY shown_in`
    ),
    counted('donate_clicked', 'source')
  ].join('\nUNION ALL ')
}

/**
 * For installs first seen in the range, how many opened the app again each day after, up to the
 * range's end, so a past range shows what was known by then.
 */
function retentionQuery(range: MetricsQuery) {
  return `SELECT toString(f.first_day), dateDiff('day', f.first_day, toDate(e.timestamp)) AS n, count(DISTINCT e.distinct_id)
FROM events e
INNER JOIN (SELECT distinct_id, min(toDate(timestamp)) AS first_day FROM events WHERE event = 'app_opened' GROUP BY distinct_id) AS f ON e.distinct_id = f.distinct_id
WHERE e.event = 'app_opened' AND ${dayRange(range, 'f.first_day')} AND ${dayRange(range, 'toDate(e.timestamp)')}
GROUP BY f.first_day, n`
}

const ranked = (rows: [string, string, number][]): RankedCount[] =>
  orderBy(
    rows.map(([, name, value]) => ({ name: name || 'unknown', value })),
    ['value'],
    ['desc']
  )

const placementSchema = v.picklist(CAMPAIGN_PLACEMENTS)
const donationSourceSchema = v.picklist(DONATION_SOURCES)

/** Shown, put off, and followed per campaign and placement, the most shown first. */
function campaignCounts(rowsOf: (kind: string) => [string, string, number][]) {
  const rows = CAMPAIGN_EVENTS.flatMap((event) =>
    rowsOf(event).map(([, shownIn, value]) => ({ event, shownIn, value }))
  )
  const campaigns = Object.entries(groupBy(rows, (row) => row.shownIn)).flatMap(
    ([shownIn, counts]) => {
      const [campaign = '', placement] = shownIn.split(' ')
      const parsed = v.safeParse(placementSchema, placement)
      if (!parsed.success) return []
      const count = (event: string) => counts.find((row) => row.event === event)?.value ?? 0
      return [
        {
          campaign,
          placement: parsed.output,
          shown: count('campaign_shown'),
          dismissed: count('campaign_dismissed'),
          acted: count('campaign_acted')
        }
      ]
    }
  )
  return orderBy(campaigns, ['shown'], ['desc'])
}

/**
 * Runs one HogQL query over PostHog's query API with a personal key that can only read queries,
 * and checks each row against `row`. The project runs at most three queries at once, so callers
 * run theirs one after the other.
 */
export async function queryPostHog<T extends v.GenericSchema>(
  env: FeedbackBindings,
  services: FeedbackServices,
  sql: string,
  row: T,
  /** Constants the query names as `{placeholder}`, which PostHog binds rather than splices in. */
  values?: Record<string, string | number>
): Promise<v.InferOutput<T>[]> {
  const response = await services.fetch(
    `${env.POSTHOG_APP_HOST}/api/projects/${env.POSTHOG_PROJECT_ID}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.POSTHOG_PERSONAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query: sql, ...(values && { values }) }
      }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS)
    }
  )
  if (!response.ok) throw new Error(`PostHog answered ${response.status}`)
  const schema = v.pipe(v.string(), v.parseJson(), v.object({ results: v.array(row) }))
  const parsed = v.safeParse(schema, await response.text())
  if (!parsed.success) throw new Error('PostHog sent an unexpected answer')
  return parsed.output.results
}

/**
 * Installs, retention, and usage by kind for the range, from PostHog; the two queries run one
 * after the other.
 */
export async function fetchUsage(
  env: FeedbackBindings,
  services: FeedbackServices,
  range: MetricsQuery
): Promise<MetricsUsage> {
  const usage = await queryPostHog(env, services, usageQuery(range), usageRowSchema)
  const retention = await queryPostHog(env, services, retentionQuery(range), retentionRowSchema)
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
        const last = maxOf(counts.keys())
        return {
          cohort,
          values: Array.from({ length: last + 1 }, (_, day) => counts.get(day) ?? 0)
        }
      }),
    documents: ranked(rowsOf('document_opened')),
    exports: ranked(rowsOf('document_exported')),
    aiProviders: ranked(rowsOf('ai_reply_finished')),
    campaigns: campaignCounts(rowsOf),
    donations: orderBy(
      rowsOf('donate_clicked').flatMap(([, source, clicks]) => {
        const parsed = v.safeParse(donationSourceSchema, source)
        return parsed.success ? [{ source: parsed.output, clicks }] : []
      }),
      ['clicks'],
      ['desc']
    )
  }
}
