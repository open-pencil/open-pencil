import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createTestService, type TestService } from '#feedback-tests/harness'
import { metricsSnapshotSchema, type MetricsSnapshot } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import * as v from 'valibot'

let service: TestService
let signingKey: CryptoKey
let strangerKey: CryptoKey

const TEAM = 'https://openpencil.cloudflareaccess.com'
const AUDIENCE = 'admin-audience'
const POSTHOG_QUERY = 'https://eu.posthog.com/api/projects/267806/query/'
const NOW = new Date('2026-10-20T12:00:00.000Z')
const TABLES = [
  'usagePings',
  'waitlist',
  'githubStars',
  'releaseDownloads',
  'repoTraffic',
  'repoReferrers',
  'siteVisits',
  'sitePages',
  'siteCountries',
  'repoItems'
] as const

/** An Access token as Cloudflare would issue it, signed with `key`; `expiresIn` null leaves `exp` out. */
function accessToken(
  key: CryptoKey,
  claims: { aud?: string; iss?: string; expiresIn?: number | null } = {}
) {
  const seconds = Math.floor(NOW.getTime() / 1000)
  const token = new SignJWT({ email: 'dan@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'current' })
    .setIssuer(claims.iss ?? TEAM)
    .setAudience(claims.aud ?? AUDIENCE)
    .setIssuedAt(seconds - 7200)
  const expiresIn = claims.expiresIn === undefined ? 3600 : claims.expiresIn
  return (expiresIn === null ? token : token.setExpirationTime(seconds + expiresIn)).sign(key)
}

async function getSnapshot(query: string, token?: string) {
  return service.request(`/admin/api/snapshot?${query}`, {
    headers: token ? { 'cf-access-jwt-assertion': token } : {}
  })
}

/** The snapshot through the typed client, as the dashboard asks for it. */
async function snapshot(start = '2026-10-14', end = '2026-10-20'): Promise<MetricsSnapshot> {
  const response = await service.client.admin.api.snapshot.$get(
    { query: { start, end } },
    { headers: { 'cf-access-jwt-assertion': await accessToken(signingKey) } }
  )
  if (response.status !== 200) throw new Error(`The snapshot answered ${response.status}`)
  return response.json()
}

/** The service's D1 through the same typed Kysely the Worker uses. */
const database = () => createFeedbackDatabase(service.db)

/** A day's pings from one build, as the ping route counts them. */
function ping(
  day: string,
  build: { version?: string; platform: string; arch?: string; app: string; browser?: string },
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
      count
    })
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
  const current = await generateKeyPair('RS256')
  signingKey = current.privateKey
  strangerKey = (await generateKeyPair('RS256')).privateKey
  const publicKey = { ...(await exportJWK(current.publicKey)), kid: 'current', alg: 'RS256' }
  service.respond(`${TEAM}/cdn-cgi/access/certs`, () => Response.json({ keys: [publicKey] }))
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
  test('daily active installs cover every day, with no pings counting as zero', async () => {
    await ping('2026-10-15', { platform: 'macos', app: 'desktop' }, 400)
    await ping(
      '2026-10-15',
      { platform: 'windows', arch: 'x64', app: 'web', browser: 'chrome' },
      300
    )
    const { dailyActive } = await snapshot('2026-10-14', '2026-10-16')
    expect(dailyActive).toEqual([
      { day: '2026-10-14', desktop: 0, web: 0 },
      { day: '2026-10-15', desktop: 400, web: 300 },
      { day: '2026-10-16', desktop: 0, web: 0 }
    ])
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
      await ping(day, { version, platform: 'macos', app: 'desktop' }, count)
    const { versions, releases } = await snapshot('2026-10-14', '2026-10-15')
    expect(versions.latest).toBe('0.16.0')
    expect(versions.daily).toEqual([
      { day: '2026-10-14', latest: 354, other: 11 },
      { day: '2026-10-15', latest: 0, other: 1 }
    ])
    expect(releases).toEqual([
      { day: '2026-10-14', version: '0.15.1' },
      { day: '2026-10-14', version: '0.16.0' }
    ])
  })

  test('platforms add desktop and web per OS, largest first', async () => {
    await ping('2026-10-15', { platform: 'linux', arch: 'x64', app: 'web', browser: 'firefox' }, 5)
    await ping('2026-10-15', { platform: 'macos', app: 'desktop' }, 9)
    await ping('2026-10-16', { platform: 'macos', app: 'web', browser: 'safari' }, 3)
    expect((await snapshot()).platforms).toEqual([
      { os: 'macos', desktop: 9, web: 3 },
      { os: 'linux', desktop: 0, web: 5 }
    ])
  })

  test('downloads and stars grow by the difference between end-of-day totals', async () => {
    await database()
      .insertInto('githubStars')
      .values([
        { day: '2026-10-13', stars: 9000, forks: 900 },
        { day: '2026-10-14', stars: 9030, forks: 905 },
        { day: '2026-10-15', stars: 9068, forks: 910 }
      ])
      .execute()
    await database()
      .insertInto('releaseDownloads')
      .values([
        { day: '2026-10-13', tag: 'v0.15.1', kind: 'windows-installer', downloads: 2000 },
        { day: '2026-10-13', tag: 'v0.15.1', kind: 'update-check', downloads: 15000 },
        { day: '2026-10-14', tag: 'v0.15.1', kind: 'windows-installer', downloads: 2010 },
        { day: '2026-10-14', tag: 'v0.16.0', kind: 'macos-installer', downloads: 100 },
        { day: '2026-10-14', tag: 'v0.16.0', kind: 'update-check', downloads: 1110 },
        { day: '2026-10-14', tag: 'v0.15.1', kind: 'update-check', downloads: 15400 }
      ])
      .execute()
    const { github } = await snapshot('2026-10-14', '2026-10-15')
    expect(github.stars).toEqual({
      total: 9068,
      daily: [
        { day: '2026-10-14', added: 30 },
        { day: '2026-10-15', added: 38 }
      ]
    })
    expect(github.downloads).toEqual({
      total: 2110,
      latestTag: 'v0.16.0',
      latestTotal: 100,
      daily: [{ day: '2026-10-14', added: 110 }],
      updateChecks: [{ day: '2026-10-14', added: 1510 }]
    })
  })

  test('visits pivot to the website and the web app, and rankings add up the range', async () => {
    await database()
      .insertInto('siteVisits')
      .values([
        { day: '2026-10-14', host: 'openpencil.dev', visits: 3884 },
        { day: '2026-10-14', host: 'app.openpencil.dev', visits: 729 }
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
      { day: '2026-10-14', site: 3884, app: 729 },
      { day: '2026-10-15', site: 0, app: 0 }
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

  test('issues and pull requests count open ones per finished day, team apart from community', async () => {
    expect((await snapshot()).github.activity).toEqual({ issues: [], pulls: [] })
    const opened = (createdAt: string) => ({ createdAt, updatedAt: createdAt })
    await database()
      .insertInto('repoItems')
      .values([
        // Open before the range, closed inside it.
        {
          number: 1,
          kind: 'issue',
          authorAssociation: 'NONE',
          ...opened('2026-10-10T09:00:00.000Z'),
          closedAt: '2026-10-15T05:00:00.000Z',
          mergedAt: null
        },
        {
          number: 2,
          kind: 'issue',
          authorAssociation: 'MEMBER',
          ...opened('2026-10-15T23:59:59.000Z'),
          closedAt: null,
          mergedAt: null
        },
        // Closed before the range: counts nowhere.
        {
          number: 3,
          kind: 'issue',
          authorAssociation: 'CONTRIBUTOR',
          ...opened('2026-10-01T09:00:00.000Z'),
          closedAt: '2026-10-05T09:00:00.000Z',
          mergedAt: null
        },
        // Opened today, which is not counted yet.
        {
          number: 4,
          kind: 'issue',
          authorAssociation: 'CONTRIBUTOR',
          ...opened('2026-10-20T09:00:00.000Z'),
          closedAt: null,
          mergedAt: null
        },
        {
          number: 5,
          kind: 'pull',
          authorAssociation: 'OWNER',
          ...opened('2026-10-14T09:00:00.000Z'),
          closedAt: '2026-10-16T09:00:00.000Z',
          mergedAt: '2026-10-16T09:00:00.000Z'
        },
        // Closed without merging.
        {
          number: 6,
          kind: 'pull',
          authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
          ...opened('2026-10-16T09:00:00.000Z'),
          closedAt: '2026-10-17T09:00:00.000Z',
          mergedAt: null
        }
      ])
      .execute()
    const { activity } = (await snapshot('2026-10-14', '2026-10-20')).github
    const zero = { openedTeam: 0, openedCommunity: 0, closedTeam: 0, closedCommunity: 0 }
    expect(activity.issues).toEqual([
      { day: '2026-10-14', openTeam: 0, openCommunity: 1, ...zero },
      {
        day: '2026-10-15',
        openTeam: 1,
        openCommunity: 0,
        ...zero,
        openedTeam: 1,
        closedCommunity: 1
      },
      { day: '2026-10-16', openTeam: 1, openCommunity: 0, ...zero },
      { day: '2026-10-17', openTeam: 1, openCommunity: 0, ...zero },
      { day: '2026-10-18', openTeam: 1, openCommunity: 0, ...zero },
      { day: '2026-10-19', openTeam: 1, openCommunity: 0, ...zero }
    ])
    const unmerged = { mergedTeam: 0, mergedCommunity: 0 }
    expect(activity.pulls.slice(0, 4)).toEqual([
      { day: '2026-10-14', openTeam: 1, openCommunity: 0, ...zero, ...unmerged, openedTeam: 1 },
      { day: '2026-10-15', openTeam: 1, openCommunity: 0, ...zero, ...unmerged },
      {
        day: '2026-10-16',
        openTeam: 0,
        openCommunity: 1,
        ...zero,
        openedCommunity: 1,
        closedTeam: 1,
        mergedTeam: 1,
        mergedCommunity: 0
      },
      { day: '2026-10-17', openTeam: 0, openCommunity: 0, ...zero, ...unmerged, closedCommunity: 1 }
    ])
  })

  test('the waitlist shows email domains only', async () => {
    await database()
      .insertInto('waitlist')
      .values([
        {
          email: 'Ada@Example.com',
          emailKey: 'ada@example.com',
          note: null,
          token: 't1',
          createdAt: '2026-10-15T08:00:00.000Z',
          confirmationSentAt: '2026-10-15T08:00:00.000Z',
          confirmedAt: '2026-10-15T08:01:00.000Z'
        },
        {
          email: 'bob@studio.io',
          emailKey: 'bob@studio.io',
          note: 'note',
          token: 't2',
          createdAt: '2026-10-01T08:00:00.000Z',
          confirmationSentAt: '2026-10-01T08:00:00.000Z',
          confirmedAt: null
        }
      ])
      .execute()
    const { waitlist } = await snapshot()
    expect(waitlist).toEqual({
      total: 2,
      confirmed: 1,
      added: 1,
      recent: [{ domain: 'example.com', signedUpAt: '2026-10-15T08:00:00.000Z', confirmed: true }]
    })
    expect(JSON.stringify(waitlist)).not.toContain('@')
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
