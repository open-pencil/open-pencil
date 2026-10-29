import { eachDay, utcDayOf } from '#feedback/days'
import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { type CalendarDate, maxDate, minDate, parseDate } from '@internationalized/date'
import { compact } from 'es-toolkit'

import { cloudflareClient } from './cloudflare'
import { githubClient } from './github'
import { lastDay, lastItemUpdate, replaceDays, saveRepoItems, type SnapshotStore } from './store'

/**
 * How far back the visit history is filled: Cloudflare's Free plan keeps 31 days and answers at
 * most 30 per query, so four weeks stays inside both.
 */
const BACKFILL_DAYS = 28
/** Days Cloudflare may still be counting; they are fetched again on the next runs. */
const SETTLING_DAYS = 3
/**
 * Pages of 100 issues and pull requests one run reads at most, which keeps a run inside the
 * Worker's subrequest limit; a bigger first sync finishes on the next runs.
 */
const MAX_ITEM_PAGES = 20

export type SnapshotSource = 'github' | 'traffic' | 'site' | 'activity'

interface Run {
  store: SnapshotStore
  env: FeedbackBindings
  services: FeedbackServices
  today: CalendarDate
  /** The day that just ended, which this run records. */
  yesterday: CalendarDate
}

/** Stars, forks, and running download totals as of the end of yesterday. */
async function recordGithub({ store, env, services, yesterday }: Run) {
  const github = githubClient(services.fetch, env.GITHUB_REPOSITORY, env.GITHUB_TOKEN)
  const totals = await github.totals()
  const day = yesterday.toString()
  await replaceDays(
    store,
    'githubStars',
    [yesterday],
    [{ day, stars: totals.stars, forks: totals.forks }]
  )
  await replaceDays(
    store,
    'releaseDownloads',
    [yesterday],
    totals.downloads.map((file) => ({ day, ...file }))
  )
}

/** GitHub's last 14 days of views and clones, finished days only, and its referrer ranking. */
async function recordTraffic({ store, env, services, today, yesterday }: Run) {
  const github = githubClient(services.fetch, env.GITHUB_REPOSITORY, env.GITHUB_TOKEN)
  const traffic = await github.traffic()
  const finished = traffic.days.filter((day) => day.day.compare(today) < 0)
  const first = finished.at(0)
  // GitHub may not have counted yesterday yet; its window still ends there.
  const window = first ? eachDay(first.day, yesterday) : []
  await replaceDays(
    store,
    'repoTraffic',
    window,
    finished.map((day) => ({ ...day, day: day.day.toString() }))
  )
  await replaceDays(
    store,
    'repoReferrers',
    [yesterday],
    traffic.referrers.map((referrer) => ({ day: yesterday.toString(), ...referrer }))
  )
}

/**
 * Visits per hostname, and the website's pages and countries, for every day not recorded yet
 * plus the last few, which Cloudflare may still have been counting.
 */
async function recordSite({ store, env, services, yesterday }: Run) {
  const cloudflare = cloudflareClient(
    services.fetch,
    env.SITE_ZONE_ID,
    env.CLOUDFLARE_ANALYTICS_TOKEN
  )
  const hosts = env.SITE_HOSTS.split(',').map((host) => host.trim())
  const [website] = hosts
  const oldest = yesterday.subtract({ days: BACKFILL_DAYS - 1 })
  const recorded = await lastDay(store.db, 'siteVisits')
  const next = recorded ? parseDate(recorded).add({ days: 1 }) : oldest
  const settling = yesterday.subtract({ days: SETTLING_DAYS - 1 })
  // Start at the first missing day or the first still settling, whichever is earlier, but never
  // before the oldest day Cloudflare still has.
  const start = maxDate(minDate(next, settling), oldest) ?? oldest

  const days = eachDay(start, yesterday)
  const counted = await cloudflare.visits(start, yesterday, hosts)
  // Cloudflare leaves out a host's day without visits; it is recorded as zero, so every fetched
  // day has a row for every host and the newest one is truly where the records stop.
  const visits = days.flatMap((date) => {
    const day = date.toString()
    return hosts.map(
      (host) =>
        counted.find((row) => row.day === day && row.host === host) ?? { day, host, visits: 0 }
    )
  })
  if (website) {
    for (const day of days) {
      const { pages, countries } = await cloudflare.breakdown(day, website)
      await replaceDays(store, 'sitePages', [day], pages)
      await replaceDays(store, 'siteCountries', [day], countries)
    }
  }
  // Recorded last: the newest visit day is where the next run resumes, so a breakdown failing
  // partway leaves the whole range to be fetched again rather than skipped for good.
  await replaceDays(store, 'siteVisits', days, visits)
}

/**
 * Issues and pull requests updated since the last sync, the first time the whole history. Each
 * page resumes from the newest update on the page before, so an item updated mid-sync moves to
 * a later page instead of shifting another one past the window. Items deleted or transferred
 * away keep their last mirrored state.
 */
async function recordActivity({ store, env, services }: Run) {
  const github = githubClient(services.fetch, env.GITHUB_REPOSITORY, env.GITHUB_TOKEN)
  let since = await lastItemUpdate(store.db)
  for (let page = 0; page < MAX_ITEM_PAGES; page++) {
    const { items, full } = await github.itemsUpdatedSince(since)
    await saveRepoItems(store, items)
    const newest = items.at(-1)?.updatedAt
    // A full page that ends where it started would be read again forever.
    if (!full || !newest || newest === since) return
    since = newest
  }
}

const SOURCES: [SnapshotSource, (run: Run) => Promise<void>][] = [
  ['github', recordGithub],
  ['traffic', recordTraffic],
  ['site', recordSite],
  ['activity', recordActivity]
]

/**
 * The daily metrics snapshot, run just after midnight UTC. GitHub reports only running totals
 * and keeps traffic for 14 days, and Cloudflare keeps visits for 31, so these tables are the
 * only lasting history; issues and pull requests are mirrored whole. Each source runs on its own: one failing still records the others, and
 * its gap is filled by the next run where the API still has the days.
 */
export async function runSnapshot(
  env: FeedbackBindings,
  services: FeedbackServices
): Promise<{ failed: SnapshotSource[] }> {
  const today = utcDayOf(services.now())
  const run: Run = {
    store: { db: createFeedbackDatabase(env.DB), d1: env.DB },
    env,
    services,
    today,
    yesterday: today.subtract({ days: 1 })
  }
  const failed = await Promise.all(
    SOURCES.map(async ([source, record]) => {
      try {
        await record(run)
        return undefined
      } catch (error) {
        console.error('Metrics snapshot failed', { source, error: String(error) })
        return source
      }
    })
  )
  return { failed: compact(failed) }
}
