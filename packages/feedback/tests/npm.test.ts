import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createTestService, type FetchCall, type TestService } from '#feedback-tests/harness'
import { eachDay } from '#feedback/days'
import { createFeedbackDatabase } from '#feedback/db'
import { runSnapshot } from '#feedback/snapshot'
import { parseDate } from '@internationalized/date'

let service: TestService

const ORG = 'https://registry.npmjs.org/-/org/open-pencil/package'
const DOWNLOADS = 'https://api.npmjs.org/downloads/range/'
// The cron fires just after midnight, so the day that just ended is Oct 19.
const RUN_AT = new Date('2026-10-20T00:05:00.000Z')

const database = () => createFeedbackDatabase(service.db)

/** The organization publishes `packages`. */
function answerOrg(packages: string[]) {
  service.respond(ORG, () =>
    Response.json(Object.fromEntries(packages.map((name) => [name, 'write'])))
  )
}

/** The range and package a download query asks about. */
function askedFor(call: FetchCall) {
  const [range = '', ...name] = call.url.slice(DOWNLOADS.length).split('/')
  const [start = '', end = ''] = range.split(':')
  return { start, end, name: name.join('/') }
}

/** npm counts `perDay` downloads of every package on every day it is asked about. */
function answerDownloads(perDay: number) {
  service.respond(DOWNLOADS, (call) => {
    const { start, end, name } = askedFor(call)
    const days = eachDay(parseDate(start), parseDate(end))
    return Response.json({
      start,
      end,
      package: name,
      downloads: days.map((day) => ({ day: day.toString(), downloads: perDay }))
    })
  })
}

const downloadCalls = () =>
  service.fetchCalls.filter((call) => call.url.startsWith(DOWNLOADS)).map(askedFor)

beforeAll(async () => {
  service = await createTestService()
})

beforeEach(async () => {
  await database().deleteFrom('npmDownloads').execute()
  service.fetchCalls.length = 0
  service.clearResponses()
  service.setNow(RUN_AT)
  answerOrg(['@open-pencil/vue', '@open-pencil/core'])
  answerDownloads(7)
})

afterAll(async () => {
  await service.dispose()
})

describe('npm downloads', () => {
  test('the first run fills each package as far back as npm keeps', async () => {
    const { failed } = await runSnapshot(service.env, service.services)
    expect(failed).not.toContain('npm')
    const asked = { start: '2025-04-28', end: '2026-10-19' }
    expect(downloadCalls()).toEqual([
      { ...asked, name: '@open-pencil/core' },
      { ...asked, name: '@open-pencil/vue' }
    ])
    const rows = await database()
      .selectFrom('npmDownloads')
      .select(['package', (eb) => eb.fn.countAll<number>().as('days')])
      .groupBy('package')
      .orderBy('package')
      .execute()
    expect(rows).toEqual([
      { package: '@open-pencil/core', days: 540 },
      { package: '@open-pencil/vue', days: 540 }
    ])
  })

  test('the next night fetches again only the days npm may still be counting', async () => {
    answerDownloads(0)
    await runSnapshot(service.env, service.services)
    service.fetchCalls.length = 0
    answerDownloads(7)
    service.setNow(new Date('2026-10-21T00:05:00.000Z'))
    await runSnapshot(service.env, service.services)
    expect(downloadCalls().map(({ start, end }) => [start, end])).toEqual([
      ['2026-10-18', '2026-10-20'],
      ['2026-10-18', '2026-10-20']
    ])
    const settled = await database()
      .selectFrom('npmDownloads')
      .select(['day', 'downloads'])
      .where('package', '=', '@open-pencil/core')
      .where('day', '>=', '2026-10-17')
      .orderBy('day')
      .execute()
    // A day first read as zero while npm was still counting is corrected on the next runs.
    expect(settled).toEqual([
      { day: '2026-10-17', downloads: 0 },
      { day: '2026-10-18', downloads: 7 },
      { day: '2026-10-19', downloads: 7 },
      { day: '2026-10-20', downloads: 7 }
    ])
  })

  test('a package published later is filled from as far back as npm keeps', async () => {
    await runSnapshot(service.env, service.services)
    service.fetchCalls.length = 0
    answerOrg(['@open-pencil/vue', '@open-pencil/core', '@open-pencil/taffy'])
    service.setNow(new Date('2026-10-21T00:05:00.000Z'))
    await runSnapshot(service.env, service.services)
    expect(downloadCalls().map(({ start }) => start)).toEqual([
      '2025-04-29',
      '2025-04-29',
      '2025-04-29'
    ])
  })

  test('npm failing for one package records nothing, so the next run asks again', async () => {
    service.respond(`${DOWNLOADS}2025-04-28:2026-10-19/@open-pencil/vue`, () =>
      Response.json({ error: 'busy' }, { status: 503 })
    )
    const { failed } = await runSnapshot(service.env, service.services)
    expect(failed).toContain('npm')
    expect(await database().selectFrom('npmDownloads').selectAll().execute()).toEqual([])
  })
})
