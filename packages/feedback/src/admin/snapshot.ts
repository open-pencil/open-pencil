import type { DailyGrowth, MetricsQuery, MetricsSnapshot, RankedCount } from '#feedback/contract'
import { eachDay, utcDayOf, utcDayOfTimestamp } from '#feedback/days'
import { createFeedbackDatabase, type FeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { minDate, parseDate, toZoned } from '@internationalized/date'
import { countBy, groupBy, maxBy, omit, partition, sumBy } from 'es-toolkit'
import type { Kysely } from 'kysely'

import { fetchUsage } from './posthog'

/** How many entries a ranking keeps. */
const TOP = 10
/** How many recent sign-ups the waitlist list shows. */
const RECENT_SIGNUPS = 50
/** The kinds of release file that are installers rather than updates or update checks. */
const INSTALLER_KINDS = new Set(['macos-installer', 'windows-installer', 'linux-installer'])

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/

/** A released version's parts, or `undefined` for betas, development builds, and anything else. */
function stableParts(version: string): [number, number, number] | undefined {
  const match = STABLE_VERSION.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

function newestStable(versions: string[]): string | undefined {
  return maxBy(
    versions.filter((version) => stableParts(version)),
    (version) => {
      const [major = 0, minor = 0, patch = 0] = stableParts(version) ?? []
      return major * 1e12 + minor * 1e6 + patch
    }
  )
}

/** Each day's increase in a running total, from the day before the range on. */
function dailyGrowth(days: string[], totals: Map<string, number>): DailyGrowth[] {
  return days.flatMap((day) => {
    const total = totals.get(day)
    const before = totals.get(parseDate(day).subtract({ days: 1 }).toString())
    return total === undefined || before === undefined ? [] : [{ day, added: total - before }]
  })
}

const ranking = (rows: { name: string; value: number | string | bigint | null }[]): RankedCount[] =>
  rows.map((row) => ({ name: row.name, value: Number(row.value ?? 0) }))

async function pings(db: Kysely<FeedbackDatabase>, range: MetricsQuery, days: string[]) {
  const inRange = db
    .selectFrom('usagePings')
    .where('day', '>=', range.start)
    .where('day', '<=', range.end)
  const [byApp, byPlatform, byVersion, versions] = await Promise.all([
    inRange
      .select(['day', 'app', (eb) => eb.fn.sum<number>('count').as('pings')])
      .groupBy(['day', 'app'])
      .execute(),
    inRange
      .select(['platform', 'app', (eb) => eb.fn.sum<number>('count').as('pings')])
      .groupBy(['platform', 'app'])
      .execute(),
    inRange
      .select(['day', 'version', (eb) => eb.fn.sum<number>('count').as('pings')])
      .groupBy(['day', 'version'])
      .execute(),
    db
      .selectFrom('usagePings')
      .select(['version', (eb) => eb.fn.min<string>('day').as('firstDay')])
      .groupBy('version')
      .execute()
  ])
  const latest = newestStable(versions.map((row) => row.version)) ?? null
  const pingsOn = (rows: typeof byApp, day: string, app: string) =>
    Number(rows.find((row) => row.day === day && row.app === app)?.pings ?? 0)
  const platforms = Object.entries(groupBy(byPlatform, (row) => row.platform)).map(
    ([os, rows]) => ({
      os,
      desktop: Number(rows.find((row) => row.app === 'desktop')?.pings ?? 0),
      web: Number(rows.find((row) => row.app === 'web')?.pings ?? 0)
    })
  )
  return {
    dailyActive: days.map((day) => ({
      day,
      desktop: pingsOn(byApp, day, 'desktop'),
      web: pingsOn(byApp, day, 'web')
    })),
    platforms: platforms.toSorted((a, b) => b.desktop + b.web - (a.desktop + a.web)),
    versions: {
      latest,
      daily: days.map((day) => {
        const onDay = byVersion.filter((row) => row.day === day)
        const latestPings = Number(onDay.find((row) => row.version === latest)?.pings ?? 0)
        return {
          day,
          latest: latestPings,
          other: sumBy(onDay, (row) => Number(row.pings)) - latestPings
        }
      })
    },
    releases: versions
      .filter(
        (row) =>
          stableParts(row.version) && row.firstDay >= range.start && row.firstDay <= range.end
      )
      .map((row) => ({ day: row.firstDay, version: row.version }))
      .toSorted((a, b) => a.day.localeCompare(b.day))
  }
}

async function networks(db: Kysely<FeedbackDatabase>, range: MetricsQuery) {
  const rows = await db
    .selectFrom('pingNetworks')
    .select(['asn', 'app', 'name', (eb) => eb.fn.sum<number>('count').as('pings')])
    .where('day', '>=', range.start)
    .where('day', '<=', range.end)
    .groupBy(['asn', 'app', 'name'])
    .execute()
  const ranked = Object.values(groupBy(rows, (row) => String(row.asn)))
    .map((network) => ({
      asn: network[0]?.asn ?? 0,
      // Cloudflare words an operator's name differently between requests, and sometimes leaves it
      // out; the commonest reported one names it.
      name:
        maxBy(
          Object.values(
            groupBy(
              network.filter((row) => row.name !== ''),
              (row) => row.name
            )
          ),
          (wording) => sumBy(wording, (row) => Number(row.pings))
        )?.[0]?.name ?? '',
      desktop: sumBy(network, (row) => (row.app === 'desktop' ? Number(row.pings) : 0)),
      web: sumBy(network, (row) => (row.app === 'web' ? Number(row.pings) : 0))
    }))
    .toSorted((a, b) => b.desktop + b.web - (a.desktop + a.web))
  return { total: sumBy(rows, (row) => Number(row.pings)), top: ranked.slice(0, TOP) }
}

async function site(
  db: Kysely<FeedbackDatabase>,
  env: FeedbackBindings,
  range: MetricsQuery,
  days: string[]
) {
  const [website, app] = env.SITE_HOSTS.split(',').map((host) => host.trim())
  const [visits, pages, countries] = await Promise.all([
    db
      .selectFrom('siteVisits')
      .selectAll()
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .execute(),
    db
      .selectFrom('sitePages')
      .select(['path as name', (eb) => eb.fn.sum<number>('visits').as('value')])
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .groupBy('path')
      .orderBy('value', 'desc')
      .limit(TOP)
      .execute(),
    db
      .selectFrom('siteCountries')
      .select(['country as name', (eb) => eb.fn.sum<number>('visits').as('value')])
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .groupBy('country')
      .orderBy('value', 'desc')
      .limit(TOP)
      .execute()
  ])
  const visitsOn = (day: string, host: string | undefined) =>
    visits.find((row) => row.day === day && row.host === host)?.visits ?? 0
  return {
    visits: days.map((day) => ({ day, site: visitsOn(day, website), app: visitsOn(day, app) })),
    website: { pages: ranking(pages), countries: ranking(countries) }
  }
}

async function github(
  db: Kysely<FeedbackDatabase>,
  range: MetricsQuery,
  days: string[],
  finished: string[]
) {
  // One day earlier than the range, so its first day has something to grow from.
  const from = parseDate(range.start).subtract({ days: 1 }).toString()
  const [stars, downloads, traffic, lastReferrerDay, daily] = await Promise.all([
    db
      .selectFrom('githubStars')
      .selectAll()
      .where('day', '>=', from)
      .where('day', '<=', range.end)
      .execute(),
    db
      .selectFrom('releaseDownloads')
      .selectAll()
      .where('day', '>=', from)
      .where('day', '<=', range.end)
      .execute(),
    db
      .selectFrom('repoTraffic')
      .selectAll()
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .orderBy('day')
      .execute(),
    db
      .selectFrom('repoReferrers')
      .select((eb) => eb.fn.max('day').as('day'))
      .where('day', '<=', range.end)
      .executeTakeFirst(),
    // The mirror is synced once a day, so today's counts would still be yesterday's.
    activity(db, range, finished)
  ])
  const referrers = lastReferrerDay?.day
    ? await db
        .selectFrom('repoReferrers')
        .select(['referrer as name', 'views as value'])
        .where('day', '=', lastReferrerDay.day)
        .orderBy('views', 'desc')
        .limit(TOP)
        .execute()
    : []

  const installers = downloads.filter((row) => INSTALLER_KINDS.has(row.kind))
  const totalsByDay = (rows: typeof downloads) =>
    new Map(
      Object.entries(groupBy(rows, (row) => row.day)).map(([day, onDay]) => [
        day,
        sumBy(onDay, (row) => row.downloads)
      ])
    )
  const installerTotals = totalsByDay(installers)
  // ISO dates sort in calendar order, as D1 compares them too.
  const lastDay = [...installerTotals.keys()].toSorted().at(-1)
  const latestTag = newestStable(installers.map((row) => row.tag.replace(/^v/, '')))
  const starTotals = new Map(stars.map((row) => [row.day, row.stars]))
  const lastStars = stars.toSorted((a, b) => a.day.localeCompare(b.day)).at(-1)
  return {
    stars: { total: lastStars?.stars ?? null, daily: dailyGrowth(days, starTotals) },
    downloads: {
      total: lastDay ? (installerTotals.get(lastDay) ?? null) : null,
      latestTag: latestTag ? `v${latestTag}` : null,
      latestTotal:
        lastDay && latestTag
          ? sumBy(
              installers.filter((row) => row.day === lastDay && row.tag === `v${latestTag}`),
              (row) => row.downloads
            )
          : null,
      daily: dailyGrowth(days, installerTotals),
      updateChecks: dailyGrowth(
        days,
        totalsByDay(downloads.filter((row) => row.kind === 'update-check'))
      )
    },
    traffic: traffic.map((row) => ({
      day: row.day,
      views: row.views,
      uniqueViews: row.uniqueViews,
      clones: row.clones
    })),
    referrers: ranking(referrers),
    activity: daily
  }
}

/** The range as sign-up timestamps: from the start day's UTC midnight up to the day after the end. */
function timestampRange(range: MetricsQuery) {
  const midnight = (day: string) => toZoned(parseDate(day), 'UTC').toDate().toISOString()
  return {
    from: midnight(range.start),
    until: midnight(parseDate(range.end).add({ days: 1 }).toString())
  }
}

/** The authors GitHub counts as the repository's own; everyone else is the community. */
const TEAM_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

type RepoItemRow = Pick<
  FeedbackDatabase['repoItems'],
  'kind' | 'authorAssociation' | 'createdAt' | 'closedAt' | 'mergedAt'
>

/**
 * Each finished day's open issues or pull requests, counted from the mirror: open before the
 * range, plus what was opened, minus what was closed, day by day. Times are compared as the
 * ISO strings they are stored as.
 */
function tally(items: RepoItemRow[], days: string[], from: string, until: string) {
  const inRange = (moment: string | null): moment is string =>
    moment !== null && moment >= from && moment < until
  const perDay = (moments: (string | null)[]) =>
    countBy(moments.filter(inRange), (moment) => utcDayOfTimestamp(moment).toString())
  const count = (group: RepoItemRow[]) => {
    const opened = perDay(group.map((item) => item.createdAt))
    const closed = perDay(group.map((item) => item.closedAt))
    const merged = perDay(group.map((item) => item.mergedAt))
    let open = group.filter((item) => item.createdAt < from).length
    return days.map((day) => {
      open += (opened[day] ?? 0) - (closed[day] ?? 0)
      return { open, opened: opened[day] ?? 0, closed: closed[day] ?? 0, merged: merged[day] ?? 0 }
    })
  }
  const [team, community] = partition(items, (item) =>
    TEAM_ASSOCIATIONS.has(item.authorAssociation)
  )
  const byTeam = count(team)
  const byCommunity = count(community)
  // Both tallies have one entry per day, in the same order.
  return days.map((day, index) => {
    const ours = byTeam[index]
    const theirs = byCommunity[index]
    return {
      day,
      openTeam: ours.open,
      openCommunity: theirs.open,
      openedTeam: ours.opened,
      openedCommunity: theirs.opened,
      closedTeam: ours.closed,
      closedCommunity: theirs.closed,
      mergedTeam: ours.merged,
      mergedCommunity: theirs.merged
    }
  })
}

async function activity(db: Kysely<FeedbackDatabase>, range: MetricsQuery, days: string[]) {
  const { from, until } = timestampRange(range)
  const [items, synced] = await Promise.all([
    db
      .selectFrom('repoItems')
      .select(['kind', 'authorAssociation', 'createdAt', 'closedAt', 'mergedAt'])
      .where('createdAt', '<', until)
      .where((eb) => eb.or([eb('closedAt', 'is', null), eb('closedAt', '>=', from)]))
      .execute(),
    db.selectFrom('repoItems').select('number').limit(1).executeTakeFirst()
  ])
  if (!synced) return { issues: [], pulls: [] }
  const [pulls, issues] = partition(items, (item) => item.kind === 'pull')
  return {
    // Issues are never merged.
    issues: tally(issues, days, from, until).map((day) =>
      omit(day, ['mergedTeam', 'mergedCommunity'])
    ),
    pulls: tally(pulls, days, from, until)
  }
}

async function waitlist(db: Kysely<FeedbackDatabase>, range: MetricsQuery) {
  const { from, until } = timestampRange(range)
  const [totals, recent] = await Promise.all([
    db
      .selectFrom('waitlist')
      .select((eb) => [
        eb.fn.countAll<number>().as('total'),
        eb.fn.count<number>('confirmedAt').as('confirmed'),
        eb.fn
          .countAll<number>()
          .filterWhere('createdAt', '>=', from)
          .filterWhere('createdAt', '<', until)
          .as('added')
      ])
      .executeTakeFirst(),
    db
      .selectFrom('waitlist')
      .select(['email', 'createdAt', 'confirmedAt'])
      .where('createdAt', '>=', from)
      .where('createdAt', '<', until)
      .orderBy('createdAt', 'desc')
      .limit(RECENT_SIGNUPS)
      .execute()
  ])
  return {
    total: Number(totals?.total ?? 0),
    confirmed: Number(totals?.confirmed ?? 0),
    added: Number(totals?.added ?? 0),
    // Only the domain leaves the database; the address itself never reaches the dashboard.
    recent: recent.map((row) => ({
      domain: row.email.slice(row.email.lastIndexOf('@') + 1).toLowerCase(),
      signedUpAt: row.createdAt,
      confirmed: row.confirmedAt !== null
    }))
  }
}

/** The first day anything was recorded: visits are backfilled, so they can predate the first ping. */
async function firstDay(db: Kysely<FeedbackDatabase>): Promise<string | null> {
  const [pinged, visited] = await Promise.all([
    db
      .selectFrom('usagePings')
      .select((eb) => eb.fn.min<string>('day').as('day'))
      .executeTakeFirst(),
    db
      .selectFrom('siteVisits')
      .select((eb) => eb.fn.min<string>('day').as('day'))
      .executeTakeFirst()
  ])
  const days = [pinged?.day, visited?.day].filter((day) => typeof day === 'string')
  return days.toSorted().at(0) ?? null
}

/**
 * The dashboard's data for a range of UTC days: pings, snapshots, and the waitlist from D1, and
 * usage from PostHog. PostHog failing leaves `usage` empty rather than failing the whole page.
 */
export async function buildSnapshot(
  env: FeedbackBindings,
  services: FeedbackServices,
  query: MetricsQuery
): Promise<MetricsSnapshot> {
  const now = services.now()
  const today = utcDayOf(now)
  const end = minDate(parseDate(query.end), today) ?? today
  const range = { start: query.start, end: end.toString() }
  const days = eachDay(parseDate(range.start), end).map(String)
  // Visits and the issue mirror are recorded once a day has ended, so today never has any.
  const finished = days.filter((day) => parseDate(day).compare(today) < 0)
  const db = createFeedbackDatabase(env.DB)
  const [earliest, pinged, byNetwork, visited, repository, signups, usage] = await Promise.all([
    firstDay(db),
    pings(db, range, days),
    networks(db, range),
    site(db, env, range, finished),
    github(db, range, days, finished),
    waitlist(db, range),
    fetchUsage(env, services, range).catch((error: unknown) => {
      console.warn('PostHog usage unavailable', { error: String(error) })
      return null
    })
  ])
  return {
    asOf: now.toISOString(),
    today: today.toString(),
    earliest,
    ...range,
    ...pinged,
    networks: byNetwork,
    ...visited,
    github: repository,
    waitlist: signups,
    usage
  }
}
