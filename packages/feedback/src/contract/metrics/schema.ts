import { type CalendarDate, parseDate } from '@internationalized/date'
import * as v from 'valibot'

import { CAMPAIGN_PLACEMENTS, DONATION_SOURCES } from '../schema'

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
  aiProviders: v.array(rankedCountSchema),
  /** Each campaign in each placement: how often it showed, was put off, and had its button followed. */
  campaigns: v.array(
    v.object({
      campaign: v.string(),
      placement: v.picklist(CAMPAIGN_PLACEMENTS),
      shown: countSchema,
      dismissed: countSchema,
      acted: countSchema
    })
  ),
  /** Times the donation page was opened, by where; whether a donation followed is not known. */
  donations: v.array(v.object({ source: v.picklist(DONATION_SOURCES), clicks: countSchema }))
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
  /** Checked installs each day, new and returning, by desktop and web; replayed pings are left out. */
  dailyActive: v.array(v.object({ day: isoDaySchema, desktop: countSchema, web: countSchema })),
  /**
   * Each day's pings from versions that send a step, replayed ones included, by the install's
   * answer to sharing usage stats: how big a share of installs PostHog's numbers stand for.
   */
  sharing: v.array(
    v.object({ day: isoDaySchema, granted: countSchema, denied: countSchema, unset: countSchema })
  ),
  /**
   * Each day's pings: from versions that send a step, new installs, returning installs the steps
   * before can account for, and pings they cannot, which replay a saved state; `unchecked` from
   * versions that send none, which nothing can tell from a replay.
   */
  installs: v.array(
    v.object({
      day: isoDaySchema,
      new: countSchema,
      returning: countSchema,
      replayed: countSchema,
      unchecked: countSchema
    })
  ),
  /** Pings in the range from versions that send a step, replayed ones included, by OS, desktop and web. */
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
  /**
   * Pings each day from versions that send a step, on the newest stable version and on the rest,
   * and every ping from versions that send none.
   */
  versions: v.object({
    latest: v.nullable(v.string()),
    daily: v.array(
      v.object({
        day: isoDaySchema,
        latest: countSchema,
        other: countSchema,
        unchecked: countSchema
      })
    )
  }),
  /** The first day each stable version sent a ping, within the range. */
  releases: v.array(v.object({ day: isoDaySchema, version: v.string() })),
  /**
   * Cloudflare visits each finished day to the website, the web app's old address, and the Cloud
   * site it moved to; today is not recorded yet.
   */
  visits: v.array(
    v.object({ day: isoDaySchema, site: countSchema, app: countSchema, cloud: countSchema })
  ),
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
    /** GitHub's referrers over the 14 days up to `day`, the range's last snapshot of them. */
    referrers: v.object({ day: v.nullable(isoDaySchema), top: v.array(rankedCountSchema) }),
    /** Issues and pull requests per finished day, by the team and by everyone else; empty until the first sync. */
    activity: v.object({
      issues: v.array(issueDaySchema),
      pulls: v.array(
        v.object({
          ...issueDaySchema.entries,
          mergedTeam: countSchema,
          mergedCommunity: countSchema
        })
      ),
      /**
       * People with a merged pull request by the end of each finished day, and those whose first
       * merged that day; empty until the mirror knows its authors.
       */
      contributors: v.array(
        v.object({
          day: isoDaySchema,
          team: countSchema,
          community: countSchema,
          newTeam: countSchema,
          newCommunity: countSchema
        })
      )
    })
  }),
  /**
   * OpenPencil Cloud's counts per finished day, and its totals at the end of the range's last
   * snapshot; `null` before the first snapshot recorded any.
   */
  cloud: v.nullable(
    v.object({
      days: v.array(
        v.object({
          day: isoDaySchema,
          signUps: countSchema,
          /** Accounts that signed in or saved a revision; editing in a shared room alone is not seen. */
          activeAccounts: countSchema,
          documentsCreated: countSchema,
          revisions: countSchema
        })
      ),
      totals: v.nullable(
        v.object({
          day: isoDaySchema,
          accounts: countSchema,
          documents: countSchema,
          workspaces: countSchema,
          storageBytes: countSchema
        })
      )
    })
  ),
  /**
   * npm downloads of the organization's packages per finished day, and each package's in the
   * range; empty until the first snapshot.
   */
  npm: v.object({
    daily: v.array(v.object({ day: isoDaySchema, downloads: countSchema })),
    packages: v.array(rankedCountSchema)
  }),
  usage: v.nullable(metricsUsageSchema)
})
export type MetricsSnapshot = v.InferOutput<typeof metricsSnapshotSchema>
