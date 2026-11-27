import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { requestSnapshot, trustAccessKey } from '#feedback-tests/access'
import { createTestService, type TestService } from '#feedback-tests/harness'
import { createFeedbackDatabase } from '#feedback/db'
import type { CryptoKey } from 'jose'

let service: TestService
let signingKey: CryptoKey

const NOW = new Date('2026-10-20T12:00:00.000Z')
const TABLES = ['githubStars', 'releaseDownloads', 'repoItems'] as const

/** The service's D1 through the same typed Kysely the Worker uses. */
const database = () => createFeedbackDatabase(service.db)

const snapshot = (start = '2026-10-14', end = '2026-10-20') =>
  requestSnapshot(service, signingKey, NOW, start, end)

beforeAll(async () => {
  service = await createTestService()
  signingKey = (await trustAccessKey(service)).signingKey
  // PostHog's usage is beside the point here; an empty answer keeps it quiet.
  service.respond('https://eu.posthog.com/', () => Response.json({ results: [] }))
})

beforeEach(async () => {
  for (const table of TABLES) await database().deleteFrom(table).execute()
  service.setNow(NOW)
})

afterAll(async () => {
  await service.dispose()
})

describe('GitHub in the metrics snapshot', () => {
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

  test('issues and pull requests count open ones per finished day, team apart from community', async () => {
    expect((await snapshot()).github.activity).toEqual({ issues: [], pulls: [], contributors: [] })
    const opened = (createdAt: string) => ({ createdAt, updatedAt: createdAt, author: null })
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

  test('contributors count people from their first merged pull request, bots and closed ones aside', async () => {
    const pull = (
      number: number,
      author: string | null,
      association: string,
      mergedAt: string | null
    ) => ({
      number,
      kind: 'pull' as const,
      authorAssociation: association,
      author,
      createdAt: '2026-10-01T09:00:00.000Z',
      closedAt: mergedAt ?? '2026-10-16T09:00:00.000Z',
      mergedAt,
      updatedAt: '2026-10-16T09:00:00.000Z'
    })
    await database()
      .insertInto('repoItems')
      .values([
        // Before the range: counted from the first day on.
        pull(1, 'ada', 'OWNER', '2026-10-02T09:00:00.000Z'),
        pull(2, 'grace', 'CONTRIBUTOR', '2026-10-03T09:00:00.000Z'),
        // A second merge adds no one.
        pull(3, 'grace', 'CONTRIBUTOR', '2026-10-15T09:00:00.000Z'),
        pull(4, 'linus', 'CONTRIBUTOR', '2026-10-15T10:00:00.000Z'),
        // Closed unmerged, by a bot, and today's, which is not finished.
        pull(5, 'ken', 'CONTRIBUTOR', null),
        pull(6, null, 'NONE', '2026-10-16T09:00:00.000Z'),
        pull(7, 'barbara', 'MEMBER', '2026-10-20T09:00:00.000Z')
      ])
      .execute()
    const { contributors } = (await snapshot('2026-10-14', '2026-10-20')).github.activity
    const none = { newTeam: 0, newCommunity: 0 }
    expect(contributors.slice(0, 3)).toEqual([
      { day: '2026-10-14', team: 1, community: 1, ...none },
      { day: '2026-10-15', team: 1, community: 2, newTeam: 0, newCommunity: 1 },
      { day: '2026-10-16', team: 1, community: 2, ...none }
    ])
    expect(contributors.at(-1)).toEqual({ day: '2026-10-19', team: 1, community: 2, ...none })
  })
})
