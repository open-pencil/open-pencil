import {
  REPORT_INBOX_LIMIT,
  type InboxReport,
  type InboxReportStep,
  type MetricsQuery,
  type ReportDetail,
  type ReportInbox,
  type ReportTriage
} from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { chunk, keyBy } from 'es-toolkit'
import * as v from 'valibot'

import { dayRange, queryPostHog } from './posthog'

/**
 * A property PostHog holds as a list, such as a report's files or steps. The query API returns
 * one either as the list itself or as its JSON text, so both are taken.
 */
const listSchema = v.nullable(v.union([v.string(), v.array(v.unknown())]))

const reportRowSchema = v.tuple([
  v.string(), // event uuid
  v.picklist(['problem_reported', '$exception']),
  v.number(), // received, Unix seconds
  v.pipe(v.string(), v.uuid()), // report ID
  v.nullable(v.string()), // note
  v.nullable(v.string()), // email
  v.nullable(v.string()), // version
  v.nullable(v.string()), // platform
  v.nullable(v.string()), // arch
  v.nullable(v.string()), // app
  v.nullable(v.string()), // browser
  listSchema, // files
  listSchema // exceptions
])
type ReportRow = v.InferOutput<typeof reportRowSchema>

const stepsRowSchema = v.tuple([listSchema])

const exceptionSchema = v.looseObject({ type: v.string(), value: v.optional(v.string()) })
const stepSchema = v.looseObject({
  $message: v.string(),
  $timestamp: v.optional(v.string()),
  category: v.optional(v.string()),
  level: v.optional(v.string())
})

const REPORT_COLUMNS = `uuid, event, toUnixTimestamp(timestamp), properties.report_id, properties.report_note, properties.report_email, properties.version, properties.platform, properties.arch, properties.app, properties.browser, properties.report_files, properties.$exception_list`

/**
 * Reports people sent in the range, newest first: every problem report, and the error reports
 * whose sender wrote a note or left an address. Errors without either are crashes, which
 * PostHog's error tracking groups on its own.
 */
function inboxQuery(range: MetricsQuery): string {
  return `SELECT ${REPORT_COLUMNS}
FROM events
WHERE event IN ('problem_reported', '$exception') AND properties.report_id IS NOT NULL AND ${dayRange(range)}
  AND (event = 'problem_reported' OR coalesce(properties.report_note, '') != '' OR coalesce(properties.report_email, '') != '')
ORDER BY timestamp DESC
LIMIT ${REPORT_INBOX_LIMIT + 1}`
}

/** One report by its ID, which the route has already checked is a UUID. */
function reportQuery(reportId: string, columns: string): string {
  return `SELECT ${columns}
FROM events
WHERE event IN ('problem_reported', '$exception') AND properties.report_id = '${reportId}'
LIMIT 1`
}

/** A list property's items, whichever way PostHog returned it; anything unreadable is none. */
function listItems<T extends v.GenericSchema>(
  value: v.InferOutput<typeof listSchema>,
  item: T
): v.InferOutput<T>[] {
  if (value === null) return []
  const parsed = v.safeParse(
    typeof value === 'string'
      ? v.pipe(v.string(), v.parseJson(), v.array(v.unknown()))
      : v.array(v.unknown()),
    value
  )
  if (!parsed.success) return []
  return parsed.output.flatMap((entry) => {
    const one = v.safeParse(item, entry)
    return one.success ? [one.output] : []
  })
}

/** Where the team opens an event in PostHog. */
function eventURL(env: FeedbackBindings, uuid: string, receivedAt: string): string {
  return `${env.POSTHOG_APP_HOST}/project/${env.POSTHOG_PROJECT_ID}/events/${uuid}/${encodeURIComponent(receivedAt)}`
}

type TriageRow = {
  status: ReportTriage['status']
  note: string | null
  handledBy: string
  handledAt: string
}

function toInboxReport(
  env: FeedbackBindings,
  row: ReportRow,
  triage: TriageRow | undefined
): InboxReport {
  const [
    uuid,
    event,
    seconds,
    id,
    note,
    email,
    version,
    platform,
    arch,
    app,
    browser,
    files,
    exceptions
  ] = row
  const receivedAt = new Date(seconds * 1000).toISOString()
  const first = listItems(exceptions, exceptionSchema).at(0)
  return {
    id,
    kind: event === '$exception' ? 'error' : 'problem',
    receivedAt,
    note: note || null,
    email: email || null,
    version,
    platform,
    arch,
    app,
    browser,
    error: first ? (first.value ? `${first.type}: ${first.value}` : first.type) : null,
    files: listItems(files, v.string()).map((url) => ({
      name: url.slice(url.lastIndexOf('/') + 1),
      url
    })),
    eventURL: eventURL(env, uuid, receivedAt),
    status: triage?.status ?? 'open',
    triageNote: triage?.note ?? null,
    handledBy: triage?.handledBy ?? null,
    handledAt: triage?.handledAt ?? null
  }
}

/** D1 binds at most 100 parameters to a statement, so IDs are looked up this many at a time. */
const TRIAGE_LOOKUP_CHUNK = 100

async function triageFor(env: FeedbackBindings, reportIds: string[]) {
  const database = createFeedbackDatabase(env.DB)
  const rows = []
  for (const ids of chunk(reportIds, TRIAGE_LOOKUP_CHUNK)) {
    rows.push(
      ...(await database
        .selectFrom('reportTriage')
        .selectAll()
        .where('reportId', 'in', ids)
        .execute())
    )
  }
  return keyBy(rows, (row) => row.reportId)
}

/** The inbox for a range: reports from PostHog, each with the triage the team saved for it. */
export async function fetchReportInbox(
  env: FeedbackBindings,
  services: FeedbackServices,
  range: MetricsQuery
): Promise<ReportInbox> {
  const rows = await queryPostHog(env, services, inboxQuery(range), reportRowSchema)
  const shown = rows.slice(0, REPORT_INBOX_LIMIT)
  const triage = await triageFor(
    env,
    shown.map((row) => row[3])
  )
  return {
    reports: shown.map((row) => toInboxReport(env, row, triage[row[3]])),
    truncated: rows.length > REPORT_INBOX_LIMIT
  }
}

/** One report with the steps that led up to it, or null when PostHog has no such report. */
export async function fetchReportDetail(
  env: FeedbackBindings,
  services: FeedbackServices,
  reportId: string
): Promise<ReportDetail | null> {
  const row = (
    await queryPostHog(env, services, reportQuery(reportId, REPORT_COLUMNS), reportRowSchema)
  ).at(0)
  if (!row) return null
  const steps = (
    await queryPostHog(
      env,
      services,
      reportQuery(
        reportId,
        "if(event = '$exception', properties.$exception_steps, properties.report_steps)"
      ),
      stepsRowSchema
    )
  ).at(0)
  const triage = await triageFor(env, [reportId])
  return {
    ...toInboxReport(env, row, triage[reportId]),
    steps: listItems(steps?.[0] ?? null, stepSchema).map((step): InboxReportStep => ({
      name: step.$message,
      category: step.category ?? null,
      level: step.level ?? null,
      timestamp: step.$timestamp ?? null
    }))
  }
}

/** Records where the team stands with a report, and who changed it. */
export async function saveReportTriage(
  env: FeedbackBindings,
  reportId: string,
  triage: ReportTriage,
  handledBy: string,
  now: Date
): Promise<void> {
  const row = {
    status: triage.status,
    note: triage.note || null,
    handledBy,
    handledAt: now.toISOString()
  }
  await createFeedbackDatabase(env.DB)
    .insertInto('reportTriage')
    .values({ reportId, ...row })
    .onConflict((conflict) => conflict.column('reportId').doUpdateSet(row))
    .execute()
}
