import * as v from 'valibot'

// The team's report inbox in the metrics dashboard. Reports and their triage live in PostHog;
// the service keeps nothing of either.

/**
 * Where the team stands with a report: nobody has looked yet, someone wrote back to the sender,
 * or nothing more is to be done. A report with no triage saved is open.
 */
export const REPORT_STATUSES = ['open', 'replied', 'closed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]
/** The inbox's filters: one per status, and every report. */
export const REPORT_INBOX_FILTERS = [...REPORT_STATUSES, 'all'] as const
export type ReportInboxFilter = (typeof REPORT_INBOX_FILTERS)[number]

/** How long an internal note on a report may be. */
export const REPORT_TRIAGE_NOTE_MAX_LENGTH = 2000
/** How many reports one page of the inbox holds. */
export const REPORT_INBOX_PAGE_SIZE = 50
/** How long a search of the inbox may be. */
export const REPORT_INBOX_SEARCH_MAX_LENGTH = 200

/**
 * Where a page of the inbox starts: after the report received at `at` (Unix milliseconds) with
 * event `uuid`, newest first. Opaque to the dashboard, which hands back what the last page gave.
 */
const reportCursorSchema = v.pipe(v.string(), v.regex(/^\d{1,15}:[0-9a-f-]{36}$/))

/** A page of the inbox: one filter, an optional search, and where the last page ended. */
export const reportInboxQuerySchema = v.object({
  filter: v.optional(v.picklist(REPORT_INBOX_FILTERS), 'open'),
  search: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(REPORT_INBOX_SEARCH_MAX_LENGTH))),
  after: v.optional(reportCursorSchema)
})
export type ReportInboxQuery = v.InferOutput<typeof reportInboxQuerySchema>

/** What the team records about a report: its status and an internal note. */
/**
 * A change to a report's triage: its status, its note (`null` clears it), or both. Only what
 * changed is sent, so two people triaging the same report keep each other's other field.
 */
export const reportTriageSchema = v.pipe(
  v.strictObject({
    status: v.optional(v.picklist(REPORT_STATUSES)),
    note: v.optional(
      v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(REPORT_TRIAGE_NOTE_MAX_LENGTH)))
    )
  }),
  v.check(
    (triage) => triage.status !== undefined || triage.note !== undefined,
    'A triage change needs a status or a note.'
  )
)
export type ReportTriage = v.InferOutput<typeof reportTriageSchema>

/** A triage change as saved: what changed, and who changed it when. */
export const reportTriageRecordSchema = v.object({
  status: v.optional(v.picklist(REPORT_STATUSES)),
  triageNote: v.optional(v.nullable(v.string())),
  handledBy: v.string(),
  handledAt: v.pipe(v.string(), v.isoTimestamp())
})
export type ReportTriageRecord = v.InferOutput<typeof reportTriageRecordSchema>

const nullableTextSchema = v.nullable(v.string())

/** One report in the inbox: what the sender wrote and their build, and the team's triage. */
export const inboxReportSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  kind: v.picklist(['error', 'problem']),
  receivedAt: v.pipe(v.string(), v.isoTimestamp()),
  note: nullableTextSchema,
  /** The address the sender left so the team can write back, if any. */
  email: nullableTextSchema,
  version: nullableTextSchema,
  platform: nullableTextSchema,
  arch: nullableTextSchema,
  app: nullableTextSchema,
  browser: nullableTextSchema,
  /** For an error, its first exception as `Type: message`. */
  error: nullableTextSchema,
  /**
   * Attached files, each a download behind Cloudflare Access until retention deletes it after
   * `REPORT_FILE_RETENTION_DAYS`; an expired one has no download left.
   */
  files: v.array(v.object({ name: v.string(), url: v.string(), expired: v.boolean() })),
  /** PostHog's list of files couldn't be read, so `files` may not be all of them. */
  filesUnreadable: v.boolean(),
  /** The report's event in PostHog. */
  eventURL: v.string(),
  status: v.picklist(REPORT_STATUSES),
  triageNote: nullableTextSchema,
  /** Who last changed the triage, by their Access email, and when. */
  handledBy: nullableTextSchema,
  handledAt: nullableTextSchema
})
export type InboxReport = v.InferOutput<typeof inboxReportSchema>

/** One page of the inbox, newest first, with how many match under each filter on the first. */
export const reportInboxSchema = v.object({
  reports: v.array(inboxReportSchema),
  /** Where the next page starts, or null on the last. */
  next: v.nullable(reportCursorSchema),
  /** How many reports match the search under each filter; only the first page counts. */
  counts: v.nullable(
    v.object({ open: v.number(), replied: v.number(), closed: v.number(), all: v.number() })
  )
})
export type ReportInbox = v.InferOutput<typeof reportInboxSchema>

/** One stack frame as the inbox shows it: symbolicated by PostHog where it could be. */
export const inboxFrameSchema = v.object({
  function: nullableTextSchema,
  file: nullableTextSchema,
  line: v.nullable(v.number()),
  column: v.nullable(v.number()),
  /** The app's own code, rather than a library's or the browser's. */
  inApp: v.boolean(),
  /** PostHog mapped it to the source through the release's source maps. */
  resolved: v.boolean()
})
export type InboxFrame = v.InferOutput<typeof inboxFrameSchema>

/** One exception of an error report; a cause chain gives several, the outermost first. */
export const inboxExceptionSchema = v.object({
  type: v.string(),
  message: nullableTextSchema,
  handled: v.nullable(v.boolean()),
  /** Where it was caught: a window error, an unhandled rejection, Vue, or a WASM panic. */
  source: nullableTextSchema,
  /** The most recent call first. */
  frames: v.array(inboxFrameSchema)
})
export type InboxException = v.InferOutput<typeof inboxExceptionSchema>

/** A step the app recorded before the report, with what it recorded about it. */
export const inboxReportStepSchema = v.object({
  name: v.string(),
  category: nullableTextSchema,
  level: nullableTextSchema,
  timestamp: nullableTextSchema,
  attributes: v.record(v.string(), v.nullable(v.union([v.string(), v.number(), v.boolean()])))
})
export type InboxReportStep = v.InferOutput<typeof inboxReportStepSchema>

/** One report whole: the steps that led up to it and, for an error, its exceptions. */
export const reportDetailSchema = v.object({
  ...inboxReportSchema.entries,
  steps: v.array(inboxReportStepSchema),
  /** PostHog's list of steps couldn't be read, so none are shown rather than some. */
  stepsUnreadable: v.boolean(),
  exceptions: v.array(inboxExceptionSchema),
  /** The error-tracking issue PostHog grouped the error into, where the code around each frame shows. */
  issueURL: nullableTextSchema
})
export type ReportDetail = v.InferOutput<typeof reportDetailSchema>
