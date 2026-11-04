import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { type FetchCall, createTestService, type TestService } from '#feedback-tests/harness'
import { eachDay } from '#feedback/days'
import { createFeedbackDatabase } from '#feedback/db'
import { runSnapshot } from '#feedback/snapshot'
import { releaseFileKind } from '#feedback/snapshot/assets'
import { replaceDays } from '#feedback/snapshot/store'
import { parseDate } from '@internationalized/date'
import * as v from 'valibot'

let service: TestService

const REPO = 'https://api.github.com/repos/open-pencil/open-pencil'
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'
// The cron fires just after midnight, so the day that just ended is Oct 19.
const RUN_AT = new Date('2026-10-20T00:05:00.000Z')
const TABLES = [
  'githubStars',
  'releaseDownloads',
  'repoTraffic',
  'repoReferrers',
  'siteVisits',
  'sitePages',
  'siteCountries',
  'repoItems'
] as const

/** An issue or pull request as `/issues` lists it, last updated `updated`. */
function item(number: number, updated: string, fields: Record<string, unknown> = {}) {
  return {
    number,
    author_association: 'CONTRIBUTOR',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: updated,
    closed_at: null,
    ...fields
  }
}

const RELEASES = [
  {
    tag_name: 'v0.16.0',
    assets: [
      { name: 'OpenPencil_0.16.0_aarch64.dmg', download_count: 100 },
      { name: 'OpenPencil_aarch64.app.tar.gz', download_count: 300 },
      { name: 'OpenPencil_aarch64.app.tar.gz.sig', download_count: 6 },
      { name: 'OpenPencil_0.16.0_x64-setup.exe', download_count: 234 },
      { name: 'OpenPencil_0.16.0_x64_en-US.msi', download_count: 42 },
      { name: 'OpenPencil_0.16.0_amd64.deb', download_count: 72 },
      { name: 'latest.json', download_count: 1110 },
      { name: 'SHA256SUMS', download_count: 23 }
    ]
  },
  {
    tag_name: 'v0.15.1',
    assets: [{ name: 'OpenPencil_0.15.1_amd64.AppImage', download_count: 393 }]
  }
]

const variablesSchema = v.object({ variables: v.record(v.string(), v.unknown()) })

/** The GraphQL variables a Cloudflare request carried. */
function variablesOf(call: FetchCall): Record<string, unknown> {
  const result = v.safeParse(
    v.pipe(v.string(), v.parseJson(), variablesSchema),
    String(call.init?.body)
  )
  if (!result.success) throw new Error('Not a GraphQL request')
  return result.output.variables
}

const cloudflareCalls = () => service.fetchCalls.filter((call) => call.url === GRAPHQL)

function answerGithub() {
  service.respond(REPO, () => Response.json({ stargazers_count: 9120, forks_count: 933 }))
  service.respond(`${REPO}/releases`, () => Response.json(RELEASES))
  service.respond(`${REPO}/traffic/views`, () =>
    Response.json({
      views: [
        { timestamp: '2026-10-18T00:00:00Z', count: 900, uniques: 400 },
        { timestamp: '2026-10-19T00:00:00Z', count: 1200, uniques: 500 },
        { timestamp: '2026-10-20T00:00:00Z', count: 30, uniques: 20 }
      ]
    })
  )
  service.respond(`${REPO}/traffic/clones`, () =>
    Response.json({ clones: [{ timestamp: '2026-10-19T00:00:00Z', count: 80, uniques: 40 }] })
  )
  service.respond(`${REPO}/traffic/popular/referrers`, () =>
    Response.json([{ referrer: 'news.ycombinator.com', count: 700, uniques: 300 }])
  )
  service.respond(`${REPO}/issues`, () =>
    Response.json([
      item(1, '2026-10-02T10:00:00Z', {
        author_association: 'MEMBER',
        closed_at: '2026-10-02T10:00:00Z',
        pull_request: { merged_at: '2026-10-02T10:00:00Z' }
      }),
      item(2, '2026-10-03T08:00:00Z')
    ])
  )
}

/** Answers every day with the same visits, and each breakdown with `pages` for the website. */
function answerCloudflare(pages: string[] = ['/', '/download']) {
  service.respond(GRAPHQL, (call) => answerOnce(call, pages))
}

function answerOnce(call: FetchCall, pages: string[] = ['/', '/download']): Response {
  const variables = variablesOf(call)
  if (typeof variables.start === 'string' && typeof variables.end === 'string') {
    const days = eachDay(parseDate(variables.start), parseDate(variables.end))
    const groups = days.map(String).flatMap((date) => [
      { sum: { visits: 4000 }, dimensions: { date, clientRequestHTTPHost: 'openpencil.dev' } },
      { sum: { visits: 1000 }, dimensions: { date, clientRequestHTTPHost: 'app.openpencil.dev' } }
    ])
    return Response.json({
      data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } }
    })
  }
  return Response.json({
    data: {
      viewer: {
        zones: [
          {
            pages: pages.map((clientRequestPath, index) => ({
              sum: { visits: 100 - index },
              dimensions: { clientRequestPath }
            })),
            countries: [
              { sum: { visits: 60 }, dimensions: { clientCountryName: 'US' } },
              { sum: { visits: 0 }, dimensions: { clientCountryName: 'XX' } }
            ]
          }
        ]
      }
    }
  })
}

/** The service's D1 through the same typed Kysely the Worker uses. */
const database = () => createFeedbackDatabase(service.db)

/** Every row of a snapshot table, in a fixed order. */
const rows = {
  githubStars: () => database().selectFrom('githubStars').selectAll().orderBy('day').execute(),
  releaseDownloads: () =>
    database().selectFrom('releaseDownloads').selectAll().orderBy(['tag', 'kind']).execute(),
  repoTraffic: () => database().selectFrom('repoTraffic').selectAll().orderBy('day').execute(),
  repoReferrers: () => database().selectFrom('repoReferrers').selectAll().orderBy('day').execute(),
  siteVisits: () =>
    database().selectFrom('siteVisits').selectAll().orderBy(['day', 'host']).execute(),
  siteCountries: () => database().selectFrom('siteCountries').selectAll().execute(),
  repoItems: () => database().selectFrom('repoItems').selectAll().orderBy('number').execute()
}

beforeAll(async () => {
  service = await createTestService()
})

beforeEach(async () => {
  for (const table of TABLES) await database().deleteFrom(table).execute()
  service.fetchCalls.length = 0
  service.clearResponses()
  service.setNow(RUN_AT)
  answerGithub()
  answerCloudflare()
})

afterAll(async () => {
  await service.dispose()
})

describe('release files', () => {
  test('counts installers, macOS updates, and update checks, and nothing else', () => {
    expect(releaseFileKind('OpenPencil_0.16.0_aarch64.dmg')).toBe('macos-installer')
    expect(releaseFileKind('OpenPencil_x64.app.tar.gz')).toBe('macos-update')
    expect(releaseFileKind('OpenPencil_0.16.0_arm64-setup.exe')).toBe('windows-installer')
    expect(releaseFileKind('OpenPencil-0.16.0-1.x86_64.rpm')).toBe('linux-installer')
    expect(releaseFileKind('latest.json')).toBe('update-check')
    expect(releaseFileKind('OpenPencil_x64.app.tar.gz.sig')).toBeUndefined()
    expect(releaseFileKind('SHA256SUMS')).toBeUndefined()
  })
})

describe('metrics snapshot', () => {
  test('records GitHub totals as of the end of the day that just ended', async () => {
    expect(await runSnapshot(service.env, service.services)).toEqual({ failed: [] })
    expect(await rows.githubStars()).toEqual([{ day: '2026-10-19', stars: 9120, forks: 933 }])
    expect(await rows.releaseDownloads()).toEqual([
      { day: '2026-10-19', tag: 'v0.15.1', kind: 'linux-installer', downloads: 393 },
      { day: '2026-10-19', tag: 'v0.16.0', kind: 'linux-installer', downloads: 72 },
      { day: '2026-10-19', tag: 'v0.16.0', kind: 'macos-installer', downloads: 100 },
      { day: '2026-10-19', tag: 'v0.16.0', kind: 'macos-update', downloads: 300 },
      { day: '2026-10-19', tag: 'v0.16.0', kind: 'update-check', downloads: 1110 },
      { day: '2026-10-19', tag: 'v0.16.0', kind: 'windows-installer', downloads: 276 }
    ])
    const github = service.fetchCalls.find((call) => call.url === REPO)
    expect(new Headers(github?.init?.headers).get('Authorization')).toBe('Bearer github-token')
  })

  test('reads every page of releases', async () => {
    const page = (tag: string) => ({
      tag_name: tag,
      assets: [{ name: 'latest.json', download_count: 1 }]
    })
    service.respond(`${REPO}/releases?per_page=100&page=1`, () =>
      Response.json(Array.from({ length: 100 }, (_, index) => page(`v0.${index}.0`)))
    )
    service.respond(`${REPO}/releases?per_page=100&page=2`, () => Response.json([page('v1.0.0')]))
    await runSnapshot(service.env, service.services)
    expect(await rows.releaseDownloads()).toHaveLength(101)
  })

  test('keeps finished traffic days only and replaces the day’s referrers', async () => {
    await database()
      .insertInto('repoReferrers')
      .values({ day: '2026-10-19', referrer: 'github.com', views: 1, uniqueViews: 1 })
      .execute()
    await runSnapshot(service.env, service.services)
    expect(await rows.repoTraffic()).toEqual([
      { day: '2026-10-18', views: 900, uniqueViews: 400, clones: 0, uniqueClones: 0 },
      { day: '2026-10-19', views: 1200, uniqueViews: 500, clones: 80, uniqueClones: 40 }
    ])
    expect(await rows.repoReferrers()).toEqual([
      { day: '2026-10-19', referrer: 'news.ycombinator.com', views: 700, uniqueViews: 300 }
    ])
  })

  test('fills four weeks of visits on the first run', async () => {
    await runSnapshot(service.env, service.services)
    const [visits, ...breakdowns] = cloudflareCalls()
    expect(visits && variablesOf(visits)).toMatchObject({
      zone: '6a1c3366d17c9cdefab66cf5dd4e1cbe',
      start: '2026-09-22',
      end: '2026-10-19',
      hosts: ['openpencil.dev', 'app.openpencil.dev']
    })
    expect(new Headers(visits?.init?.headers).get('Authorization')).toBe('Bearer cloudflare-token')
    expect(breakdowns.map((call) => variablesOf(call).host)).toEqual(
      Array.from({ length: 28 }, () => 'openpencil.dev')
    )
    expect(await rows.siteVisits()).toHaveLength(56)
    expect(await rows.siteCountries()).toHaveLength(28)
  })

  test('the next night fetches only the days Cloudflare may still be counting', async () => {
    await runSnapshot(service.env, service.services)
    service.fetchCalls.length = 0
    service.setNow(new Date(Date.parse(RUN_AT.toISOString()) + 24 * 60 * 60 * 1000))
    await runSnapshot(service.env, service.services)
    const [visits] = cloudflareCalls()
    expect(visits && variablesOf(visits)).toMatchObject({ start: '2026-10-18', end: '2026-10-20' })
    expect(cloudflareCalls()).toHaveLength(4)
  })

  test('a gap longer than the settling days is filled from where the records stop', async () => {
    const recorded = parseDate('2026-10-19').subtract({ days: 10 })
    await database()
      .insertInto('siteVisits')
      .values({ day: recorded.toString(), host: 'openpencil.dev', visits: 1 })
      .execute()
    await runSnapshot(service.env, service.services)
    const [visits] = cloudflareCalls()
    expect(visits && variablesOf(visits)).toMatchObject({
      start: recorded.add({ days: 1 }).toString()
    })
  })

  test('a page that drops out of the ranking is removed when its day is fetched again', async () => {
    await runSnapshot(service.env, service.services)
    answerCloudflare(['/'])
    await runSnapshot(service.env, service.services)
    const pages = await database()
      .selectFrom('sitePages')
      .select('path')
      .where('day', '=', '2026-10-19')
      .execute()
    expect(pages).toEqual([{ path: '/' }])
  })

  test('a breakdown failing partway records no visits, so the next run fetches the range again', async () => {
    service.respond(GRAPHQL, (call) => {
      if (variablesOf(call).day === '2026-09-26') return new Response('busy', { status: 503 })
      return answerOnce(call)
    })
    expect(await runSnapshot(service.env, service.services)).toEqual({ failed: ['site'] })
    expect(await rows.siteVisits()).toEqual([])
    answerCloudflare()
    service.fetchCalls.length = 0
    await runSnapshot(service.env, service.services)
    const [visits] = cloudflareCalls()
    expect(visits && variablesOf(visits)).toMatchObject({ start: '2026-09-22' })
    expect(await rows.siteCountries()).toHaveLength(28)
  })

  test('a day Cloudflare leaves out is recorded as zero visits', async () => {
    service.respond(GRAPHQL, (call) => {
      const variables = variablesOf(call)
      if (typeof variables.start !== 'string') return answerOnce(call)
      // Only the website had visits, and only on the last day.
      const group = {
        sum: { visits: 3000 },
        dimensions: { date: '2026-10-19', clientRequestHTTPHost: 'openpencil.dev' }
      }
      return Response.json({
        data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: [group] }] } }
      })
    })
    await runSnapshot(service.env, service.services)
    const visits = await rows.siteVisits()
    expect(visits).toHaveLength(56)
    expect(visits.filter((row) => row.visits > 0)).toEqual([
      { day: '2026-10-19', host: 'openpencil.dev', visits: 3000 }
    ])
  })

  test('a host missing from a rerun is set back to zero for that day', async () => {
    await database()
      .insertInto('siteVisits')
      .values([
        { day: '2026-10-19', host: 'app.openpencil.dev', visits: 999 },
        { day: '2026-10-18', host: 'openpencil.dev', visits: 5 }
      ])
      .execute()
    service.respond(GRAPHQL, (call) => {
      const variables = variablesOf(call)
      if (typeof variables.start !== 'string') return answerOnce(call)
      const group = {
        sum: { visits: 4000 },
        dimensions: { date: '2026-10-19', clientRequestHTTPHost: 'openpencil.dev' }
      }
      return Response.json({
        data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: [group] }] } }
      })
    })
    await runSnapshot(service.env, service.services)
    const visits = await rows.siteVisits()
    expect(visits.filter((row) => row.day >= '2026-10-18')).toEqual([
      { day: '2026-10-18', host: 'app.openpencil.dev', visits: 0 },
      { day: '2026-10-18', host: 'openpencil.dev', visits: 0 },
      { day: '2026-10-19', host: 'app.openpencil.dev', visits: 0 },
      { day: '2026-10-19', host: 'openpencil.dev', visits: 4000 }
    ])
  })

  test('a replacement that fails to insert leaves the day as it was', async () => {
    await database()
      .insertInto('siteVisits')
      .values({ day: '2026-10-19', host: 'openpencil.dev', visits: 4258 })
      .execute()
    const store = { db: database(), d1: service.db }
    // Two rows with the same key: the insert fails after the delete was already queued.
    const duplicate = { day: '2026-10-19', host: 'openpencil.dev', visits: 1 }
    await expect(
      replaceDays(store, 'siteVisits', [parseDate('2026-10-19')], [duplicate, duplicate])
    ).rejects.toThrow()
    expect(await rows.siteVisits()).toEqual([
      { day: '2026-10-19', host: 'openpencil.dev', visits: 4258 }
    ])
  })

  test('one source failing still records the others', async () => {
    service.respond(REPO, () => new Response('unavailable', { status: 503 }))
    service.respond(`${REPO}/releases`, () => new Response('unavailable', { status: 503 }))
    expect(await runSnapshot(service.env, service.services)).toEqual({ failed: ['github'] })
    expect(await rows.githubStars()).toEqual([])
    expect(await rows.repoTraffic()).toHaveLength(2)
    expect(await rows.siteVisits()).toHaveLength(56)
  })

  test('an answer of the wrong shape fails that source rather than recording it', async () => {
    service.respond(GRAPHQL, () => Response.json({ data: null, errors: [{ message: 'quota' }] }))
    expect(await runSnapshot(service.env, service.services)).toEqual({ failed: ['site'] })
    expect(await rows.siteVisits()).toEqual([])
  })

  test('mirrors issues and pull requests with their author and merge time', async () => {
    expect(await runSnapshot(service.env, service.services)).toEqual({ failed: [] })
    expect(await rows.repoItems()).toEqual([
      {
        number: 1,
        kind: 'pull',
        authorAssociation: 'MEMBER',
        createdAt: '2026-10-01T09:00:00.000Z',
        closedAt: '2026-10-02T10:00:00.000Z',
        mergedAt: '2026-10-02T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z'
      },
      {
        number: 2,
        kind: 'issue',
        authorAssociation: 'CONTRIBUTOR',
        createdAt: '2026-10-01T09:00:00.000Z',
        closedAt: null,
        mergedAt: null,
        updatedAt: '2026-10-03T08:00:00.000Z'
      }
    ])
  })

  test('pages on from the newest update, and the next run resumes there', async () => {
    const first = Array.from({ length: 100 }, (_, index) =>
      item(index + 1, `2026-10-05T10:${String(Math.floor(index / 2)).padStart(2, '0')}:00Z`)
    )
    const since = (call: FetchCall) => new URL(call.url).searchParams.get('since')
    service.respond(`${REPO}/issues`, (call) => {
      if (since(call) === null) return Response.json(first)
      // The page boundary comes back again, now closed.
      if (since(call) === '2026-10-05T10:49:00.000Z')
        return Response.json([
          item(100, '2026-10-05T11:00:00Z', { closed_at: '2026-10-05T11:00:00Z' })
        ])
      return Response.json([])
    })
    await runSnapshot(service.env, service.services)
    const items = await rows.repoItems()
    expect(items).toHaveLength(100)
    expect(items.at(-1)?.closedAt).toBe('2026-10-05T11:00:00.000Z')
    service.fetchCalls.length = 0
    await runSnapshot(service.env, service.services)
    const issueCalls = service.fetchCalls.filter((call) => call.url.startsWith(`${REPO}/issues`))
    expect(issueCalls.map(since)).toEqual(['2026-10-05T11:00:00.000Z'])
  })
})
