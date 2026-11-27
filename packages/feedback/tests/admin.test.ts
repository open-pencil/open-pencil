import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { requestSnapshot, signAccessToken, trustAccessKey } from '#feedback-tests/access'
import { createTestService, type TestService } from '#feedback-tests/harness'
import { metricsSnapshotSchema } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import type { CryptoKey } from 'jose'
import * as v from 'valibot'

let service: TestService
let signingKey: CryptoKey
let strangerKey: CryptoKey

const POSTHOG_QUERY = 'https://eu.posthog.com/api/projects/267806/query/'
const NOW = new Date('2026-10-20T12:00:00.000Z')
const TABLES = [
  'usagePings',
  'pingNetworks',
  'pingSteps',
  'githubStars',
  'releaseDownloads',
  'repoTraffic',
  'repoReferrers',
  'siteVisits',
  'sitePages',
  'siteCountries',
  'repoItems',
  'cloudUsage'
] as const

const accessToken = (key: CryptoKey, claims?: Parameters<typeof signAccessToken>[2]) =>
  signAccessToken(key, NOW, claims)

async function getSnapshot(query: string, token?: string) {
  return service.request(`/admin/api/snapshot?${query}`, {
    headers: token ? { 'cf-access-jwt-assertion': token } : {}
  })
}

/** The snapshot through the typed client, as the dashboard asks for it. */
const snapshot = (start = '2026-10-14', end = '2026-10-20') =>
  requestSnapshot(service, signingKey, NOW, start, end)

/** The service's D1 through the same typed Kysely the Worker uses. */
const database = () => createFeedbackDatabase(service.db)

/** A day's pings from one build, as the ping route counts them; `stepped` for builds that send steps. */
function ping(
  day: string,
  build: {
    version?: string
    platform: string
    arch?: string
    app: string
    browser?: string
    stepped?: boolean
  },
  count: number
) {
  return database()
    .insertInto('usagePings')
    .values({
      day,
      version: build.version ?? '0.16.0',
      platform: build.platform,
      arch: build.arch ?? 'arm64',
      app: build.app,
      browser: build.browser ?? 'unknown',
      usageStats: 'unset',
      stepped: build.stepped ? 1 : 0,
      count
    })
    .execute()
}

/** A day's pings for one app and step, as the ping route counts them. */
function steps(day: string, app: string, step: string, entered: boolean, count: number) {
  return database()
    .insertInto('pingSteps')
    .values({ day, app, step, entered: entered ? 1 : 0, count })
    .execute()
}

/** PostHog answers the usage query, then the retention query. */
function answerPostHog() {
  service.respond(POSTHOG_QUERY, (call) => {
    const body = String(call.init?.body)
    if (body.includes('INNER JOIN'))
      return Response.json({
        results: [
          ['2026-10-14', 0, 28],
          ['2026-10-14', 1, 9],
          ['2026-10-14', 3, 3],
          ['2026-10-15', 0, 59]
        ]
      })
    return Response.json({
      results: [
        ['installs', '2026-10-15', 68],
        ['installs', '2026-10-14', 30],
        ['unique', '', 216],
        ['document_opened', 'fig', 496],
        ['document_opened', 'pen', 19],
        ['ai_reply_finished', 'openrouter', 22],
        ['ai_reply_finished', 'openai-compatible', 85]
      ]
    })
  })
}

beforeAll(async () => {
  service = await createTestService()
  const keys = await trustAccessKey(service)
  signingKey = keys.signingKey
  strangerKey = keys.strangerKey
})

beforeEach(async () => {
  for (const table of TABLES) await database().deleteFrom(table).execute()
  service.setNow(NOW)
  answerPostHog()
})

afterAll(async () => {
  await service.dispose()
})

describe('admin access', () => {
  test('refuses a request without an Access token', async () => {
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20')).status).toBe(403)
  })

  test('refuses a token Cloudflare did not sign', async () => {
    const token = await accessToken(strangerKey)
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20', token)).status).toBe(403)
  })

  test('refuses a token for another Access application or team', async () => {
    const otherApp = await accessToken(signingKey, { aud: 'another-app' })
    const otherTeam = await accessToken(signingKey, {
      iss: 'https://elsewhere.cloudflareaccess.com'
    })
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20', otherApp)).status).toBe(403)
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20', otherTeam)).status).toBe(403)
  })

  test('refuses an expired token and one that never expires', async () => {
    const expired = await accessToken(signingKey, { expiresIn: -60 })
    const endless = await accessToken(signingKey, { expiresIn: null })
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20', expired)).status).toBe(403)
    expect((await getSnapshot('start=2026-10-14&end=2026-10-20', endless)).status).toBe(403)
  })

  test('refuses everyone while Access is not configured', async () => {
    const audience = service.env.ACCESS_AUD
    service.env.ACCESS_AUD = ''
    try {
      const token = await accessToken(signingKey)
      expect((await getSnapshot('start=2026-10-14&end=2026-10-20', token)).status).toBe(403)
    } finally {
      service.env.ACCESS_AUD = audience
    }
  })

  test('answers a signed-in request without letting caches keep it', async () => {
    const response = await getSnapshot(
      'start=2026-10-14&end=2026-10-20',
      await accessToken(signingKey)
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  test('serves the dashboard page only through Access, without caching', async () => {
    expect((await service.request('/admin/')).status).toBe(403)
    expect((await service.request('/admin')).status).toBe(403)
    const headers = { 'cf-access-jwt-assertion': await accessToken(signingKey) }
    const page = await service.request('/admin/', { headers })
    expect(page.status).toBe(200)
    expect(page.headers.get('Content-Type')).toBe('text/html')
    expect(page.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await page.text()).toContain('<title>Metrics</title>')
    const folder = await service.request('/admin', { headers })
    expect(folder.status).toBe(302)
    expect(folder.headers.get('Location')).toBe('/admin/')
    expect((await service.request('/admin/missing.js', { headers })).status).toBe(404)
  })

  test('rejects a missing, malformed, or reversed range', async () => {
    const token = await accessToken(signingKey)
    for (const query of [
      'start=2026-02-30&end=2026-03-02',
      'start=2026-10-14',
      'start=yesterday&end=2026-10-20',
      'start=2026-10-20&end=2026-10-14'
    ])
      expect((await getSnapshot(query, token)).status).toBe(400)
  })
})

describe('metrics snapshot API', () => {
  test('daily active installs count checked installs per app, with no pings counting as zero', async () => {
    await steps('2026-10-14', 'desktop', '1', true, 3)
    await steps('2026-10-15', 'desktop', '1', true, 400)
    // Three installs could have reached step 2, so seven of these replay a saved state.
    await steps('2026-10-15', 'desktop', '2', true, 10)
    await steps('2026-10-15', 'web', '1', true, 300)
    // Versions that send no step are not installs anyone can check.
    await ping('2026-10-15', { platform: 'macos', app: 'desktop' }, 5000)
    const { dailyActive } = await snapshot('2026-10-14', '2026-10-16')
    expect(dailyActive).toEqual([
      { day: '2026-10-14', desktop: 3, web: 0 },
      { day: '2026-10-15', desktop: 403, web: 300 },
      { day: '2026-10-16', desktop: 0, web: 0 }
    ])
  })

  test('installs follow the steps from their first day, padding the range with empty days', async () => {
    await database()
      .insertInto('pingSteps')
      .values([
        { day: '2026-10-12', app: 'desktop', step: '1', entered: 1, count: 4 },
        { day: '2026-10-15', app: 'desktop', step: '2', entered: 1, count: 9 }
      ])
      .execute()

    // The steps' own pings are in the counters too; only the rest are unchecked.
    await ping(
      '2026-10-15',
      { version: '0.17.0', platform: 'macos', app: 'desktop', stepped: true },
      9
    )
    await ping('2026-10-15', { platform: 'macos', app: 'desktop' }, 3739)

    // The steps before the range still bound it: four installs started on Oct 12.
    const { installs } = await snapshot('2026-10-15', '2026-10-16')
    expect(installs).toEqual([
      { day: '2026-10-15', new: 0, returning: 4, replayed: 5, unchecked: 3739 },
      { day: '2026-10-16', new: 0, returning: 0, replayed: 0, unchecked: 0 }
    ])
  })

  test('networks rank the range by pings under their commonest name', async () => {
    const counts = [
      ['2026-10-18', 9299, 'PLDT', 'desktop', 30],
      // The commonest wording is split between apps and comes first, so neither the biggest row
      // nor the latest day would pick it.
      ['2026-10-18', 136907, 'Huawei Cloud Singapore Region', 'desktop', 200],
      ['2026-10-18', 136907, 'Huawei Cloud Singapore Region', 'web', 150],
      ['2026-10-19', 136907, 'Huawei-Cloud-SG', 'desktop', 300],
      ['2026-10-19', 9299, 'PLDT', 'web', 20],
      // Pings without an operator name outnumber the named ones but never name the network.
      ['2026-10-19', 9299, '', 'desktop', 60],
      ['2026-10-19', 0, '', 'desktop', 5]
    ] as const
    await database()
      .insertInto('pingNetworks')
      .values(
        counts.map(([day, asn, name, app, count]) => ({
          day,
          asn,
          name,
          app,
          platform: 'macos',
          count
        }))
      )
      .execute()

    const { networks } = await snapshot()
    expect(networks).toEqual({
      total: 765,
      top: [
        { asn: 136907, name: 'Huawei Cloud Singapore Region', desktop: 500, web: 150 },
        { asn: 9299, name: 'PLDT', desktop: 90, web: 20 },
        { asn: 0, name: '', desktop: 5, web: 0 }
      ]
    })
  })

  test('the network total counts the networks the ranking leaves out', async () => {
    await database()
      .insertInto('pingNetworks')
      .values(
        Array.from({ length: 12 }, (_, index) => ({
          day: '2026-10-19',
          asn: 64500 + index,
          name: `Network ${index}`,
          app: 'desktop',
          platform: 'linux',
          count: 12 - index
        }))
      )
      .execute()

    const { networks } = await snapshot()
    expect(networks.top.map((network) => network.asn)).toEqual(
      Array.from({ length: 10 }, (_, index) => 64500 + index)
    )
    expect(networks.total).toBe(78)
  })

  test('earliest is the first day with pings or backfilled visits', async () => {
    expect((await snapshot()).earliest).toBeNull()
    await ping('2026-10-12', { version: '0.16.0-beta.2', platform: 'macos', app: 'desktop' }, 6)
    expect((await snapshot()).earliest).toBe('2026-10-12')
    await database()
      .insertInto('siteVisits')
      .values({ day: '2026-09-22', host: 'openpencil.dev', visits: 2000 })
      .execute()
    expect((await snapshot()).earliest).toBe('2026-09-22')
  })

  test('an end after today stops at today', async () => {
    const result = await snapshot('2026-10-19', '2026-12-31')
    expect(result.end).toBe('2026-10-20')
    expect(result.dailyActive.map((day) => day.day)).toEqual(['2026-10-19', '2026-10-20'])
    // Visits are recorded after a day ends, so today has none to show.
    expect(result.visits.map((day) => day.day)).toEqual(['2026-10-19'])
  })

  test('versions split the newest stable release from the rest and mark its first day', async () => {
    for (const [day, version, count] of [
      ['2026-10-13', '0.16.0-beta.3', 4],
      ['2026-10-14', '0.15.1', 2],
      ['2026-10-14', '0.16.0', 354],
      ['2026-10-14', '0.16.0-beta.2', 9],
      ['2026-10-15', '0.0.0-smoke', 1]
    ] as const)
      await ping(day, { version, platform: 'macos', app: 'desktop', stepped: true }, count)
    await ping('2026-10-14', { version: '0.15.1', platform: 'macos', app: 'desktop' }, 70)
    const { versions, releases } = await snapshot('2026-10-14', '2026-10-15')
    expect(versions.latest).toBe('0.16.0')
    expect(versions.daily).toEqual([
      { day: '2026-10-14', latest: 354, other: 11, unchecked: 70 },
      { day: '2026-10-15', latest: 0, other: 1, unchecked: 0 }
    ])
    expect(releases).toEqual([
      { day: '2026-10-14', version: '0.15.1' },
      { day: '2026-10-14', version: '0.16.0' }
    ])
  })

  test('platforms add checked pings for desktop and web per OS, largest first', async () => {
    const checked = { arch: 'x64', stepped: true }
    await ping('2026-10-15', { ...checked, platform: 'linux', app: 'web', browser: 'firefox' }, 5)
    await ping('2026-10-15', { platform: 'macos', app: 'desktop', stepped: true }, 9)
    await ping('2026-10-16', { platform: 'macos', app: 'web', browser: 'safari', stepped: true }, 3)
    await ping('2026-10-16', { platform: 'windows', app: 'desktop' }, 700)
    expect((await snapshot()).platforms).toEqual([
      { os: 'macos', desktop: 9, web: 3 },
      { os: 'linux', desktop: 0, web: 5 }
    ])
  })

  test('visits pivot to the website and the web app, and rankings add up the range', async () => {
    await database()
      .insertInto('siteVisits')
      .values([
        { day: '2026-10-14', host: 'openpencil.dev', visits: 3884 },
        { day: '2026-10-14', host: 'app.openpencil.dev', visits: 729 },
        { day: '2026-10-14', host: 'cloud.openpencil.dev', visits: 310 }
      ])
      .execute()
    await database()
      .insertInto('sitePages')
      .values([
        { day: '2026-10-14', path: '/', visits: 900 },
        { day: '2026-10-15', path: '/', visits: 1000 },
        { day: '2026-10-15', path: '/download', visits: 80 }
      ])
      .execute()
    await database()
      .insertInto('siteCountries')
      .values([
        { day: '2026-10-14', country: 'US', visits: 800 },
        { day: '2026-10-15', country: 'CN', visits: 200 }
      ])
      .execute()
    const result = await snapshot('2026-10-14', '2026-10-15')
    expect(result.visits).toEqual([
      { day: '2026-10-14', site: 3884, app: 729, cloud: 310 },
      { day: '2026-10-15', site: 0, app: 0, cloud: 0 }
    ])
    expect(result.website).toEqual({
      pages: [
        { name: '/', value: 1900 },
        { name: '/download', value: 80 }
      ],
      countries: [
        { name: 'US', value: 800 },
        { name: 'CN', value: 200 }
      ]
    })
  })

  test('Cloud usage covers every finished day, with the totals of the last snapshot', async () => {
    expect((await snapshot()).cloud).toBeNull()
    const quiet = { accounts: null, documents: null, workspaces: null, storageBytes: null }
    await database()
      .insertInto('cloudUsage')
      .values([
        {
          day: '2026-10-15',
          signUps: 4,
          activeAccounts: 6,
          documentsCreated: 2,
          revisions: 8,
          ...quiet
        },
        {
          day: '2026-10-17',
          signUps: 1,
          activeAccounts: 3,
          documentsCreated: 0,
          revisions: 5,
          accounts: 20,
          documents: 31,
          workspaces: 22,
          storageBytes: 4096
        }
      ])
      .execute()
    const { cloud } = await snapshot('2026-10-14', '2026-10-20')
    const zero = { signUps: 0, activeAccounts: 0, documentsCreated: 0, revisions: 0 }
    expect(cloud?.days).toEqual([
      { day: '2026-10-14', ...zero },
      { day: '2026-10-15', signUps: 4, activeAccounts: 6, documentsCreated: 2, revisions: 8 },
      { day: '2026-10-16', ...zero },
      { day: '2026-10-17', signUps: 1, activeAccounts: 3, documentsCreated: 0, revisions: 5 },
      { day: '2026-10-18', ...zero },
      { day: '2026-10-19', ...zero }
    ])
    expect(cloud?.totals).toEqual({
      day: '2026-10-17',
      accounts: 20,
      documents: 31,
      workspaces: 22,
      storageBytes: 4096
    })
  })

  test('usage comes from PostHog with a read-only personal key', async () => {
    const { usage } = await snapshot()
    expect(usage).toEqual({
      installs: 216,
      daily: [
        { day: '2026-10-14', installs: 30 },
        { day: '2026-10-15', installs: 68 }
      ],
      retention: [
        { cohort: '2026-10-14', values: [28, 9, 0, 3] },
        { cohort: '2026-10-15', values: [59] }
      ],
      documents: [
        { name: 'fig', value: 496 },
        { name: 'pen', value: 19 }
      ],
      exports: [],
      aiProviders: [
        { name: 'openai-compatible', value: 85 },
        { name: 'openrouter', value: 22 }
      ]
    })
    const call = service.fetchCalls.findLast((candidate) => candidate.url === POSTHOG_QUERY)
    expect(new Headers(call?.init?.headers).get('Authorization')).toBe('Bearer phx_test')
  })

  test('the answer matches the schema the dashboard parses it with', async () => {
    await ping('2026-10-15', { platform: 'macos', app: 'desktop' }, 400)
    await database()
      .insertInto('siteVisits')
      .values({ day: '2026-10-15', host: 'openpencil.dev', visits: 3000 })
      .execute()
    const response = await getSnapshot(
      'start=2026-10-14&end=2026-10-20',
      await accessToken(signingKey)
    )
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), metricsSnapshotSchema),
      await response.text()
    )
    expect(parsed.issues).toBeUndefined()
  })

  test('PostHog failing leaves usage empty and the rest of the page intact', async () => {
    service.respond(POSTHOG_QUERY, () => new Response('busy', { status: 503 }))
    const result = await snapshot()
    expect(result.usage).toBeNull()
    expect(result.dailyActive).toHaveLength(7)
  })
})
