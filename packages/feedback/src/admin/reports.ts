import {
  REPORT_FILE_RETENTION_DAYS,
  REPORT_INBOX_PAGE_SIZE,
  type InboxException,
  type InboxReport,
  type InboxReportStep,
  type ReportDetail,
  type ReportInbox,
  type ReportInboxFilter,
  type ReportInboxQuery,
  type ReportStatus,
  type ReportTriage,
  type ReportTriageRecord
} from '#feedback/contract'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import * as v from 'valibot'

import { queryPostHog } from './posthog'

/** The event the dashboard records triage with; the latest one for a report is where it stands. */
export const REPORT_TRIAGED_EVENT = 'report_triaged'
/** Who PostHog files triage under: the team, never a person's profile. */
const TRIAGE_DISTINCT_ID = 'openpencil-team'

/**
 * A property PostHog holds as a list, such as a report's files or steps. The query API returns
 * one either as the list itself or as its JSON text, so both are taken.
 */
const listSchema = v.nullable(v.union([v.string(), v.array(v.unknown())]))
const textSchema = v.nullable(v.string())

const REPORT_COLUMNS = [
  'toString(e.uuid)',
  'e.event',
  'toUnixTimestamp64Milli(e.timestamp)',
  'e.properties.report_id',
  'e.properties.report_note',
  'e.properties.report_email',
  'e.properties.version',
  'e.properties.platform',
  'e.properties.arch',
  'e.properties.app',
  'e.properties.browser',
  'e.properties.report_files',
  'e.properties.$exception_list',
  't.status',
  't.note',
  't.handled_by',
  'toUnixTimestamp64Milli(t.handled_at)'
]
const reportRowSchema = v.tuple([
  v.string(),
  v.picklist(['problem_reported', '$exception']),
  v.number(),
  v.pipe(v.string(), v.uuid()),
  textSchema,
  textSchema,
  textSchema,
  textSchema,
  textSchema,
  textSchema,
  textSchema,
  listSchema,
  listSchema,
  textSchema,
  textSchema,
  textSchema,
  v.nullable(v.number())
])
type ReportRow = v.InferOutput<typeof reportRowSchema>
/** A report row followed by its steps and the error-tracking issue PostHog grouped it into. */
const detailRowSchema = v.tuple([...reportRowSchema.items, listSchema, textSchema])

/**
 * Reports with the latest triage each has, field by field: a change carries only the field it
 * changed, and a cleared note is the empty string. A report with none, or none PostHog has
 * finished taking in yet, is open; the join's empty side is the empty string as often as null.
 */
const REPORTS_WITH_TRIAGE = `FROM events AS e
LEFT JOIN (
  SELECT properties.report_id AS report_id,
    argMaxIf(properties.status, timestamp, isNotNull(properties.status)) AS status,
    argMaxIf(properties.triage_note, timestamp, isNotNull(properties.triage_note)) AS note,
    argMax(properties.handled_by, timestamp) AS handled_by,
    max(timestamp) AS handled_at
  FROM events
  WHERE event = '${REPORT_TRIAGED_EVENT}'
  GROUP BY report_id
) AS t ON t.report_id = e.properties.report_id`
const STATUS = `if(t.status IN ('replied', 'closed'), t.status, 'open')`
/**
 * Every problem report, and the error reports whose sender wrote a note or left an address.
 * Errors without either are crashes, which PostHog's error tracking groups on its own.
 */
const IN_INBOX = `e.event IN ('problem_reported', '$exception') AND e.properties.report_id IS NOT NULL
  AND (e.event = 'problem_reported' OR coalesce(e.properties.report_note, '') != '' OR coalesce(e.properties.report_email, '') != '')`
const SEARCHED = `(e.properties.report_note ILIKE {pattern} OR e.properties.report_email ILIKE {pattern}
  OR toString(e.properties.$exception_list) ILIKE {pattern} OR e.properties.version ILIKE {pattern})`
const AFTER_CURSOR = `(toUnixTimestamp64Milli(e.timestamp) < {after_ms}
    OR (toUnixTimestamp64Milli(e.timestamp) = {after_ms} AND toString(e.uuid) < {after_uuid}))`

/** `text` as an ILIKE pattern that matches it anywhere, its own wildcards taken literally. */
const containing = (text: string) => `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`

/** A list property's items, or null when it can't be read whole; a partial list is never all. */
function readList<T extends v.GenericSchema>(
  value: v.InferOutput<typeof listSchema>,
  item: T
): v.InferOutput<T>[] | null {
  if (value === null || value === '') return []
  const list = v.array(item)
  const parsed = v.safeParse(
    typeof value === 'string' ? v.pipe(v.string(), v.parseJson(), list) : list,
    value
  )
  return parsed.success ? parsed.output : null
}

const DAY_MS = 24 * 60 * 60 * 1000

const exceptionSchema = v.looseObject({
  type: v.string(),
  value: v.optional(v.nullable(v.string())),
  mechanism: v.optional(
    v.looseObject({ handled: v.optional(v.boolean()), type: v.optional(v.string()) })
  ),
  stacktrace: v.optional(v.nullable(v.looseObject({ frames: v.optional(v.array(v.unknown())) })))
})
/** A frame raw from the app, or symbolicated by PostHog, which renames its fields. */
const frameSchema = v.looseObject({
  resolved_name: v.optional(v.nullable(v.string())),
  mangled_name: v.optional(v.nullable(v.string())),
  function: v.optional(v.nullable(v.string())),
  source: v.optional(v.nullable(v.string())),
  filename: v.optional(v.nullable(v.string())),
  line: v.optional(v.nullable(v.number())),
  lineno: v.optional(v.nullable(v.number())),
  column: v.optional(v.nullable(v.number())),
  colno: v.optional(v.nullable(v.number())),
  in_app: v.optional(v.nullable(v.boolean())),
  resolved: v.optional(v.nullable(v.boolean()))
})
const stepSchema = v.looseObject({
  $message: v.string(),
  $timestamp: v.optional(v.string()),
  category: v.optional(v.string()),
  level: v.optional(v.string())
})
const attributeValueSchema = v.nullable(v.union([v.string(), v.number(), v.boolean()]))
const ATTRIBUTE_PREFIX = 'attribute_'

/** Where the team opens an event in PostHog. */
function eventURL(env: FeedbackBindings, uuid: string, receivedAt: string): string {
  return `${env.POSTHOG_APP_HOST}/project/${env.POSTHOG_PROJECT_ID}/events/${uuid}/${encodeURIComponent(receivedAt)}`
}

const statusOf = (value: string | null): ReportStatus =>
  value === 'replied' || value === 'closed' ? value : 'open'

function toInboxReport(env: FeedbackBindings, row: ReportRow, now: Date): InboxReport {
  const [
    uuid,
    event,
    receivedMs,
    id,
    note,
    email,
    version,
    platform,
    arch,
    app,
    browser,
    files,
    exceptions,
    status,
    triageNote,
    handledBy,
    handledMs
  ] = row
  const receivedAt = new Date(receivedMs).toISOString()
  const first = readList(exceptions, exceptionSchema)?.at(0)
  const fileURLs = readList(files, v.string())
  // Retention deletes a report's files after this long, so older links would only answer 404.
  const expired = now.getTime() - receivedMs > REPORT_FILE_RETENTION_DAYS * DAY_MS
  const triaged = Boolean(handledBy)
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
    files: (fileURLs ?? []).map((url) => ({
      name: url.slice(url.lastIndexOf('/') + 1),
      url,
      expired
    })),
    filesUnreadable: fileURLs === null,
    eventURL: eventURL(env, uuid, receivedAt),
    status: statusOf(status),
    triageNote: triaged ? triageNote || null : null,
    handledBy: triaged ? handledBy : null,
    handledAt: triaged && handledMs ? new Date(handledMs).toISOString() : null
  }
}

/** Where the page that follows `row` starts: its time and event, newest first. */
const cursorOf = (row: ReportRow) => `${row[2]}:${row[0]}`

/**
 * One page of the inbox from PostHog: the reports under `filter` matching `search`, newest first,
 * after the cursor the last page gave. The first page also counts each filter's reports.
 */
export async function fetchReportInbox(
  env: FeedbackBindings,
  services: FeedbackServices,
  query: ReportInboxQuery
): Promise<ReportInbox> {
  const searchValues: Record<string, string> = {}
  const matching = [IN_INBOX]
  if (query.search) {
    searchValues.pattern = containing(query.search)
    matching.push(SEARCHED)
  }
  const values: Record<string, string | number> = { ...searchValues }
  const page = [...matching]
  if (query.filter !== 'all') {
    values.status = query.filter
    page.push(`${STATUS} = {status}`)
  }
  if (query.after) {
    const [at = '0', uuid = ''] = query.after.split(':')
    values.after_ms = Number(at)
    values.after_uuid = uuid
    page.push(AFTER_CURSOR)
  }
  const rows = await queryPostHog(
    env,
    services,
    `SELECT ${REPORT_COLUMNS.join(', ')}
${REPORTS_WITH_TRIAGE}
WHERE ${page.join('\n  AND ')}
ORDER BY e.timestamp DESC, toString(e.uuid) DESC
LIMIT ${REPORT_INBOX_PAGE_SIZE + 1}`,
    reportRowSchema,
    values
  )
  const shown = rows.slice(0, REPORT_INBOX_PAGE_SIZE)
  const last = shown.at(-1)
  return {
    reports: shown.map((row) => toInboxReport(env, row, services.now())),
    next: rows.length > REPORT_INBOX_PAGE_SIZE && last ? cursorOf(last) : null,
    counts: query.after
      ? null
      : await countReports(env, services, matching.join('\n  AND '), searchValues)
  }
}

/** How many reports match under each filter, the search included. */
async function countReports(
  env: FeedbackBindings,
  services: FeedbackServices,
  matching: string,
  values: Record<string, string>
): Promise<Record<ReportInboxFilter, number>> {
  const rows = await queryPostHog(
    env,
    services,
    `SELECT ${STATUS} AS status, count()
${REPORTS_WITH_TRIAGE}
WHERE ${matching}
GROUP BY status`,
    v.tuple([v.string(), v.number()]),
    values
  )
  const counts: Record<ReportInboxFilter, number> = { open: 0, replied: 0, closed: 0, all: 0 }
  for (const [status, count] of rows) {
    counts[statusOf(status)] += count
    counts.all += count
  }
  return counts
}

/** The exceptions of an error report, outermost first, each with its most recent call first. */
function toExceptions(value: v.InferOutput<typeof listSchema>): InboxException[] {
  return (readList(value, exceptionSchema) ?? []).map((exception) => ({
    type: exception.type,
    message: exception.value ?? null,
    handled: exception.mechanism?.handled ?? null,
    source: exception.mechanism?.type ?? null,
    frames: (exception.stacktrace?.frames ?? [])
      .flatMap((frame) => {
        const parsed = v.safeParse(frameSchema, frame)
        if (!parsed.success) return []
        const each = parsed.output
        return [
          {
            function: each.resolved_name ?? each.function ?? each.mangled_name ?? null,
            file: each.source ?? each.filename ?? null,
            line: each.line ?? each.lineno ?? null,
            column: each.column ?? each.colno ?? null,
            inApp: each.in_app ?? false,
            resolved: each.resolved ?? false
          }
        ]
      })
      // The app sends the oldest call first; the inbox reads from where it failed.
      .toReversed()
  }))
}

function toSteps(value: v.InferOutput<typeof listSchema>): InboxReportStep[] | null {
  const steps = readList(value, stepSchema)
  if (!steps) return null
  return steps.map((step) => {
    const attributes: InboxReportStep['attributes'] = {}
    for (const [key, raw] of Object.entries(step)) {
      if (!key.startsWith(ATTRIBUTE_PREFIX)) continue
      const parsed = v.safeParse(attributeValueSchema, raw)
      if (parsed.success) attributes[key.slice(ATTRIBUTE_PREFIX.length)] = parsed.output
    }
    return {
      name: step.$message,
      category: step.category ?? null,
      level: step.level ?? null,
      timestamp: step.$timestamp ?? null,
      attributes
    }
  })
}

/** One report whole, or null when PostHog has no such report. */
export async function fetchReportDetail(
  env: FeedbackBindings,
  services: FeedbackServices,
  reportId: string
): Promise<ReportDetail | null> {
  const row = (
    await queryPostHog(
      env,
      services,
      `SELECT ${REPORT_COLUMNS.join(', ')},
  if(e.event = '$exception', e.properties.$exception_steps, e.properties.report_steps),
  e.properties.$exception_issue_id
${REPORTS_WITH_TRIAGE}
WHERE e.event IN ('problem_reported', '$exception') AND e.properties.report_id = {report_id}
LIMIT 1`,
      detailRowSchema,
      { report_id: reportId }
    )
  ).at(0)
  if (!row) return null
  const [steps, issueId] = [toSteps(row[17]), row[18]]
  const report: ReportRow = [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    row[6],
    row[7],
    row[8],
    row[9],
    row[10],
    row[11],
    row[12],
    row[13],
    row[14],
    row[15],
    row[16]
  ]
  return {
    ...toInboxReport(env, report, services.now()),
    steps: steps ?? [],
    stepsUnreadable: steps === null,
    exceptions: toExceptions(row[12]),
    issueURL: issueId
      ? `${env.POSTHOG_APP_HOST}/project/${env.POSTHOG_PROJECT_ID}/error_tracking/${encodeURIComponent(issueId)}`
      : null
  }
}

/**
 * Records a change to where the team stands with a report as a `report_triaged` event in PostHog,
 * carrying only the fields that changed, which the inbox reads the latest of each; answers what
 * was saved. PostHog accepting it is enough: the inbox shows the change at once and finds it in
 * the next load once PostHog has taken it in.
 */
export async function saveReportTriage(
  env: FeedbackBindings,
  services: FeedbackServices,
  reportId: string,
  triage: ReportTriage,
  handledBy: string
): Promise<ReportTriageRecord> {
  const handledAt = services.now().toISOString()
  // Fields left undefined stay out of the event and the answer. A cleared note goes to PostHog
  // as the empty string, which a change that left the note alone never carries.
  const note = triage.note === undefined ? undefined : triage.note || null
  const response = await services.fetch(`${env.POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      batch: [
        {
          event: REPORT_TRIAGED_EVENT,
          timestamp: handledAt,
          distinct_id: TRIAGE_DISTINCT_ID,
          properties: {
            report_id: reportId,
            status: triage.status,
            triage_note: note === null ? '' : note,
            handled_by: handledBy,
            $lib: 'openpencil-feedback',
            $process_person_profile: false,
            $geoip_disable: true
          }
        }
      ]
    })
  })
  if (!response.ok) throw new Error(`PostHog refused the triage (${response.status})`)
  return { status: triage.status, triageNote: note, handledBy, handledAt }
}
