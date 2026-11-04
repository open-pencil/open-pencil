import { type CalendarDate, parseDate } from '@internationalized/date'
import * as v from 'valibot'

/** Where official OpenPencil builds send pings, usage stats, and waitlist sign-ups. */
export const FEEDBACK_ORIGIN = 'https://feedback.openpencil.dev'

export const PLATFORMS = ['macos', 'windows', 'linux', 'ios', 'android', 'unknown'] as const
export const ARCHITECTURES = ['arm64', 'x64', 'unknown'] as const
export const APP_KINDS = ['desktop', 'web'] as const
export const BROWSERS = ['chrome', 'edge', 'opera', 'firefox', 'safari', 'unknown'] as const
export const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh-CN'] as const
export const DOCUMENT_FORMATS = [
  'fig',
  'pen',
  'drawio',
  'mermaid',
  'png',
  'jpg',
  'webp',
  'svg',
  'pdf',
  'pptx',
  'jsx',
  'tailwind-jsx',
  'html'
] as const
export const AI_PROVIDERS = [
  'openrouter',
  'anthropic',
  'openai',
  'chatgpt',
  'google',
  'deepseek',
  'openai-compatible',
  'zai',
  'minimax',
  'anthropic-compatible',
  'openpencil',
  'harness:pi',
  'acp:claude-code',
  'acp:codex',
  'acp:gemini-cli',
  'acp:cursor',
  'acp:grok-build'
] as const

export type Platform = (typeof PLATFORMS)[number]
export type Architecture = (typeof ARCHITECTURES)[number]
export type AppKind = (typeof APP_KINDS)[number]
export type Browser = (typeof BROWSERS)[number]
export type Locale = (typeof LOCALES)[number]
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]
export type AIProvider = (typeof AI_PROVIDERS)[number]

/** The install's answer to the usage stats question; `unset` until it is asked and answered. */
export const USAGE_STATS_ANSWERS = ['unset', 'granted', 'denied'] as const
export type UsageStatsAnswer = (typeof USAGE_STATS_ANSWERS)[number]

/** Where a person agreed to share usage stats. */
export const CONSENT_SOURCES = ['welcome', 'prompt', 'settings'] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

/** Where a person chose to donate: the question the app asks, the File menu, or Settings. */
export const DONATION_SOURCES = ['prompt', 'menu', 'settings'] as const
export type DonationSource = (typeof DONATION_SOURCES)[number]

const appVersionSchema = v.pipe(
  v.string(),
  v.maxLength(32),
  v.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/)
)

/** The build an install runs; every ping and every usage batch carries it and nothing else about the device. */
const buildEntries = {
  version: appVersionSchema,
  platform: v.picklist(PLATFORMS),
  arch: v.picklist(ARCHITECTURES),
  app: v.picklist(APP_KINDS),
  browser: v.picklist(BROWSERS)
}

export const buildSchema = v.strictObject(buildEntries)
export type Build = v.InferOutput<typeof buildSchema>

/**
 * The daily anonymous ping: no identifier, only which build is running and how the install
 * answered the usage stats question, which counts the installs that declined.
 */
export const pingSchema = v.strictObject({
  ...buildEntries,
  usageStats: v.picklist(USAGE_STATS_ANSWERS)
})
export type Ping = v.InferOutput<typeof pingSchema>

const timestampSchema = v.pipe(v.string(), v.isoTimestamp())

/**
 * Every usage event official builds may send, and the only ones the ingest proxy forwards.
 * A property is a closed list of values, so no event can carry names, text, or paths.
 */
export const usageEventSchema = v.variant('name', [
  v.strictObject({
    name: v.literal('app_opened'),
    timestamp: timestampSchema,
    locale: v.picklist(LOCALES)
  }),
  v.strictObject({
    name: v.literal('document_opened'),
    timestamp: timestampSchema,
    format: v.picklist(DOCUMENT_FORMATS)
  }),
  v.strictObject({
    name: v.literal('document_exported'),
    timestamp: timestampSchema,
    format: v.picklist(DOCUMENT_FORMATS)
  }),
  v.strictObject({
    name: v.literal('ai_reply_finished'),
    timestamp: timestampSchema,
    provider: v.picklist(AI_PROVIDERS)
  }),
  v.strictObject({
    name: v.literal('usage_stats_enabled'),
    timestamp: timestampSchema,
    source: v.picklist(CONSENT_SOURCES)
  }),
  v.strictObject({
    name: v.literal('donate_clicked'),
    timestamp: timestampSchema,
    source: v.picklist(DONATION_SOURCES)
  })
])
export type UsageEvent = v.InferOutput<typeof usageEventSchema>
export type UsageEventName = UsageEvent['name']

export const USAGE_BATCH_LIMIT = 50

/** A random ID made on the device when its user agreed to usage stats; it names no person or account. */
export const installIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/))

/** A batch of usage events from one install that agreed to share them. */
export const usageBatchSchema = v.strictObject({
  ...buildEntries,
  installId: installIdSchema,
  events: v.pipe(v.array(usageEventSchema), v.minLength(1), v.maxLength(USAGE_BATCH_LIMIT))
})
export type UsageBatch = v.InferOutput<typeof usageBatchSchema>

/** The public Turnstile site key for the website's waitlist form; the secret lives on the Worker. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFUZEGj-sE8C_2zT'

/** The `data-action` the waitlist form gives its widget; tokens issued for anything else are refused. */
export const WAITLIST_TURNSTILE_ACTION = 'waitlist'

/** A Cloud waitlist sign-up from the website form. */
export const waitlistSignupSchema = v.strictObject({
  email: v.pipe(v.string(), v.trim(), v.maxLength(254), v.email()),
  /** What the person would use Cloud for, if they say. */
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
  turnstileToken: v.pipe(v.string(), v.minLength(1), v.maxLength(2048))
})
export type WaitlistSignup = v.InferOutput<typeof waitlistSignupSchema>

/** The longest range one request covers; a year and a bit leaves room for "all time" for now. */
export const MAX_METRICS_RANGE_DAYS = 400

/** The day a `YYYY-MM-DD` string names, or `undefined` for one that does not exist (`2026-02-30`). */
function calendarDay(day: string): CalendarDate | undefined {
  try {
    return parseDate(day)
  } catch {
    return undefined
  }
}

// `isoDate` checks only the shape, so `2026-02-30` would pass without the calendar check.
const isoDaySchema = v.pipe(
  v.string(),
  v.isoDate(),
  v.check((day) => calendarDay(day) !== undefined, 'Not a calendar day.')
)

/**
 * Days from `start` to `end`. Valibot runs the range checks even when a day failed its own
 * check, so an impossible day counts as no span and only its own issue is reported.
 */
function span({ start, end }: { start: string; end: string }): number {
  const from = calendarDay(start)
  const to = calendarDay(end)
  return from && to ? to.compare(from) : 0
}

/** The UTC days the dashboard asks about, both included. */
export const metricsQuerySchema = v.pipe(
  v.object({ start: isoDaySchema, end: isoDaySchema }),
  v.check((range) => span(range) >= 0, 'The range ends before it starts.'),
  v.check((range) => span(range) < MAX_METRICS_RANGE_DAYS, 'The range is too long.')
)

export type MetricsQuery = v.InferOutput<typeof metricsQuerySchema>

// The answer is described once, as schemas: the Worker builds values of their types, and the
// dashboard parses the network answer with them before using it.
const countSchema = v.pipe(v.number(), v.minValue(0))

const rankedCountSchema = v.object({ name: v.string(), value: countSchema })
export type RankedCount = v.InferOutput<typeof rankedCountSchema>

const dailyGrowthSchema = v.object({ day: isoDaySchema, added: v.number() })
export type DailyGrowth = v.InferOutput<typeof dailyGrowthSchema>

/**
 * A day of issues or pull requests, split between the team (the repository's owners, members,
 * and collaborators) and the community: how many were open at the end of the day, and how many
 * were opened and closed that day.
 */
const issueDaySchema = v.object({
  day: isoDaySchema,
  openTeam: countSchema,
  openCommunity: countSchema,
  openedTeam: countSchema,
  openedCommunity: countSchema,
  closedTeam: countSchema,
  closedCommunity: countSchema
})

/** What PostHog knows about the installs that share usage stats; `null` when it could not be asked. */
const metricsUsageSchema = v.object({
  /** Different installs that opened the app in the range. */
  installs: countSchema,
  daily: v.array(v.object({ day: isoDaySchema, installs: countSchema })),
  /** Per first day: index 0 is how many installs started then, index n how many came back n days later. */
  retention: v.array(v.object({ cohort: isoDaySchema, values: v.array(countSchema) })),
  documents: v.array(rankedCountSchema),
  exports: v.array(rankedCountSchema),
  aiProviders: v.array(rankedCountSchema)
})
export type MetricsUsage = v.InferOutput<typeof metricsUsageSchema>

/**
 * Everything the metrics dashboard shows for a range of UTC days. Days are ISO dates; `today`
 * is still being counted, and snapshot-based numbers only reach the last finished day.
 */
export const metricsSnapshotSchema = v.object({
  asOf: v.pipe(v.string(), v.isoTimestamp()),
  today: isoDaySchema,
  /** The first day anything was recorded (pings or visits), or `null` before the first one. */
  earliest: v.nullable(isoDaySchema),
  start: isoDaySchema,
  end: isoDaySchema,
  /** Installs that pinged each day, by desktop and web. */
  dailyActive: v.array(v.object({ day: isoDaySchema, desktop: countSchema, web: countSchema })),
  /** Pings in the range by OS, desktop and web. */
  platforms: v.array(v.object({ os: v.string(), desktop: countSchema, web: countSchema })),
  /**
   * Pings by network since network counting began: every network's pings in the range, and the
   * networks with the most; AS 0 holds pings with none reported.
   */
  networks: v.object({
    total: countSchema,
    top: v.array(
      v.object({ asn: countSchema, name: v.string(), desktop: countSchema, web: countSchema })
    )
  }),
  /** Pings each day on the newest stable version and on everything else. */
  versions: v.object({
    latest: v.nullable(v.string()),
    daily: v.array(v.object({ day: isoDaySchema, latest: countSchema, other: countSchema }))
  }),
  /** The first day each stable version sent a ping, within the range. */
  releases: v.array(v.object({ day: isoDaySchema, version: v.string() })),
  /** Cloudflare visits each finished day to the website and to the web app; today is not recorded yet. */
  visits: v.array(v.object({ day: isoDaySchema, site: countSchema, app: countSchema })),
  website: v.object({ pages: v.array(rankedCountSchema), countries: v.array(rankedCountSchema) }),
  github: v.object({
    stars: v.object({ total: v.nullable(countSchema), daily: v.array(dailyGrowthSchema) }),
    /** Installer downloads across every release, and update checks from running desktop apps. */
    downloads: v.object({
      total: v.nullable(countSchema),
      latestTag: v.nullable(v.string()),
      latestTotal: v.nullable(countSchema),
      daily: v.array(dailyGrowthSchema),
      updateChecks: v.array(dailyGrowthSchema)
    }),
    traffic: v.array(
      v.object({
        day: isoDaySchema,
        views: countSchema,
        uniqueViews: countSchema,
        clones: countSchema
      })
    ),
    referrers: v.array(rankedCountSchema),
    /** Issues and pull requests per finished day, by the team and by everyone else; empty until the first sync. */
    activity: v.object({
      issues: v.array(issueDaySchema),
      pulls: v.array(
        v.object({
          ...issueDaySchema.entries,
          mergedTeam: countSchema,
          mergedCommunity: countSchema
        })
      )
    })
  }),
  waitlist: v.object({
    total: countSchema,
    confirmed: countSchema,
    added: countSchema,
    /** Newest first, by email domain only. */
    recent: v.array(
      v.object({
        domain: v.string(),
        signedUpAt: v.pipe(v.string(), v.isoTimestamp()),
        confirmed: v.boolean()
      })
    )
  }),
  usage: v.nullable(metricsUsageSchema)
})
export type MetricsSnapshot = v.InferOutput<typeof metricsSnapshotSchema>

/** How long the files attached to a report are kept before retention deletes them. */
export const REPORT_FILE_RETENTION_DAYS = 90
export const REPORT_FILE_MAX_BYTES = 50 * 1024 * 1024
export const REPORT_STEPS_LIMIT = 50
/** The largest report body the service takes; the app leaves out the oldest steps to fit it. */
export const REPORT_BODY_MAX_BYTES = 256 * 1024
export const REPORT_FRAMES_LIMIT = 100
export const REPORT_NOTE_MAX_LENGTH = 5000

/** Where an error was caught: the window, an unhandled rejection, a Vue component, or the desktop shell. */
export const REPORT_ERROR_SOURCES = ['window', 'rejection', 'vue', 'panic'] as const
export type ReportErrorSource = (typeof REPORT_ERROR_SOURCES)[number]

export const REPORT_STEP_LEVELS = ['debug', 'info', 'warning', 'error'] as const

const text = (max: number) => v.pipe(v.string(), v.maxLength(max))
const positionSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const uuidSchema = v.pipe(v.string(), v.uuid())

/** One stack frame as PostHog's error tracking reads it; `chunk_id` points it at an uploaded source map. */
const frameSchema = v.strictObject({
  platform: v.literal('web:javascript'),
  filename: v.optional(text(1024)),
  function: v.optional(text(256)),
  lineno: v.optional(positionSchema),
  colno: v.optional(positionSchema),
  in_app: v.optional(v.boolean()),
  chunk_id: v.optional(uuidSchema)
})

/** One error in PostHog's `$exception_list` shape; a cause chain sends several. */
const exceptionSchema = v.strictObject({
  type: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  value: v.optional(text(1000)),
  mechanism: v.strictObject({
    handled: v.boolean(),
    synthetic: v.boolean(),
    type: v.picklist(REPORT_ERROR_SOURCES)
  }),
  stacktrace: v.optional(
    v.strictObject({
      type: v.literal('raw'),
      frames: v.pipe(v.array(frameSchema), v.maxLength(REPORT_FRAMES_LIMIT))
    })
  )
})

const attributeKeySchema = v.pipe(v.string(), v.regex(/^[A-Za-z][\w.]{0,63}$/))

/** A recent diagnostics event, scrubbed on the device, that led up to the report. */
const stepSchema = v.strictObject({
  name: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_.]{0,63}$/)),
  category: v.pipe(v.string(), v.regex(/^[a-z]{1,32}$/)),
  level: v.picklist(REPORT_STEP_LEVELS),
  timestamp: v.pipe(v.string(), v.isoTimestamp()),
  attributes: v.pipe(
    v.record(attributeKeySchema, v.nullable(v.union([text(4000), v.number(), v.boolean()]))),
    v.maxEntries(24)
  )
})

/**
 * The files a report may attach, each under this fixed name, never its own: the open document.
 * A name joins the list when the app starts to send that file.
 */
export const REPORT_FILE_NAMES = ['document.fig'] as const
export const reportFileNameSchema = v.picklist(REPORT_FILE_NAMES)
export type ReportFileName = v.InferOutput<typeof reportFileNameSchema>

const reportFileSchema = v.strictObject({
  name: reportFileNameSchema,
  size: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(REPORT_FILE_MAX_BYTES))
})

const reportEntries = {
  ...buildSchema.entries,
  /** Present only when the install shares usage stats, so the report joins its usage events. */
  installId: v.optional(installIdSchema),
  /** The PostHog release the app's chunks carry, which picks the source maps for its frames. */
  release: v.optional(uuidSchema),
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(REPORT_NOTE_MAX_LENGTH))),
  email: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(254), v.email())),
  steps: v.optional(v.pipe(v.array(stepSchema), v.maxLength(REPORT_STEPS_LIMIT))),
  files: v.optional(
    v.pipe(
      v.array(reportFileSchema),
      v.maxLength(REPORT_FILE_NAMES.length),
      v.check(
        (files) => new Set(files.map((file) => file.name)).size === files.length,
        'Attached files need distinct names'
      )
    )
  )
}

/**
 * A report a person chose to send: an error the app caught, or a problem they describe. Nothing
 * is sent without their click; the app shows them this body before it goes.
 */
export const reportSchema = v.variant('kind', [
  v.strictObject({
    kind: v.literal('error'),
    exceptions: v.pipe(v.array(exceptionSchema), v.minLength(1), v.maxLength(5)),
    ...reportEntries
  }),
  v.strictObject({
    kind: v.literal('problem'),
    ...reportEntries,
    note: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(REPORT_NOTE_MAX_LENGTH))
  })
])
export type Report = v.InferOutput<typeof reportSchema>
export type ReportException = v.InferOutput<typeof exceptionSchema>
export type ReportFrame = v.InferOutput<typeof frameSchema>
export type ReportStep = v.InferOutput<typeof stepSchema>
export type ReportFile = v.InferOutput<typeof reportFileSchema>

/** What `POST /reports` answers: the report's ID and, when it declared files, the token that uploads them. */
export const reportReceiptSchema = v.strictObject({
  reportId: uuidSchema,
  uploadToken: v.nullable(v.string())
})
export type ReportReceipt = v.InferOutput<typeof reportReceiptSchema>
