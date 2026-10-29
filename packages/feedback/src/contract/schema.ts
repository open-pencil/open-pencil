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
  'acp:gemini-cli'
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
  })
])
export type UsageEvent = v.InferOutput<typeof usageEventSchema>
export type UsageEventName = UsageEvent['name']

export const USAGE_BATCH_LIMIT = 50

/** A batch of usage events from one install that agreed to share them. */
export const usageBatchSchema = v.strictObject({
  ...buildEntries,
  /** A random ID made on the device when its user agreed; it names no person or account. */
  installId: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
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
