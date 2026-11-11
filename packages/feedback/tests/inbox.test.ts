import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { signAccessToken, trustAccessKey } from '#feedback-tests/access'
import { createTestService, type TestService } from '#feedback-tests/harness'
import {
  REPORT_INBOX_LIMIT,
  reportDetailSchema,
  reportInboxSchema,
  reportTriageRecordSchema,
  type ReportDetail,
  type ReportInbox
} from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import type { CryptoKey } from 'jose'
import * as v from 'valibot'

let service: TestService
let signingKey: CryptoKey

const POSTHOG_QUERY = 'https://eu.posthog.com/api/projects/267806/query/'
const NOW = new Date('2026-10-20T12:00:00.000Z')
const PROBLEM = '11111111-1111-4111-8111-111111111111'
const ERROR = '22222222-2222-4222-8222-222222222222'
const FILE_URL = `https://feedback.openpencil.dev/admin/reports/${PROBLEM}/files/document.fig`

/** A row as PostHog's query API answers the inbox's columns. */
function row(
  reportId: string,
  event: 'problem_reported' | '$exception',
  extra: {
    note?: string | null
    email?: string | null
    files?: unknown
    exceptions?: unknown
    receivedAt?: string
  } = {}
) {
  return [
    `uuid-${reportId.slice(0, 4)}`,
    event,
    Date.parse(extra.receivedAt ?? '2026-10-19T08:30:00.000Z') / 1000,
    reportId,
    extra.note ?? null,
    extra.email ?? null,
    '0.16.0',
    'macos',
    'arm64',
    'desktop',
    'unknown',
    extra.files ?? null,
    extra.exceptions ?? null
  ]
}

const sentQueries = () =>
  service.fetchCalls
    .filter((call) => call.url === POSTHOG_QUERY)
    .map((call) => String(call.init?.body))

/** PostHog answers every query with `rows`. */
function answerPostHog(rows: unknown[][]) {
  service.respond(POSTHOG_QUERY, () => Response.json({ results: rows }))
}

const headers = async () => ({ 'cf-access-jwt-assertion': await signAccessToken(signingKey, NOW) })

async function inbox(start = '2026-10-14', end = '2026-10-20'): Promise<ReportInbox> {
  const response = await service.client.admin.api.reports.$get(
    { query: { start, end } },
    { headers: await headers() }
  )
  if (response.status !== 200) throw new Error(`The inbox answered ${response.status}`)
  return v.parse(reportInboxSchema, await response.json())
}

async function detail(reportId: string): Promise<{ status: number; report?: ReportDetail }> {
  const response = await service.request(`/admin/api/reports/${reportId}`, {
    headers: await headers()
  })
  if (response.status !== 200) return { status: response.status }
  return { status: 200, report: v.parse(reportDetailSchema, await response.json()) }
}

/** Saves triage, signed in unless `signedIn` is false. */
async function triage(reportId: string, body: unknown, signedIn = true) {
  return service.request(`/admin/api/reports/${reportId}/triage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(signedIn ? await headers() : {}) },
    body: JSON.stringify(body)
  })
}

beforeAll(async () => {
  service = await createTestService()
  signingKey = (await trustAccessKey(service)).signingKey
})

beforeEach(async () => {
  await createFeedbackDatabase(service.db).deleteFrom('reportTriage').execute()
  service.fetchCalls.length = 0
  service.setNow(NOW)
})

afterAll(async () => {
  await service.dispose()
})

describe('report inbox', () => {
  test('lists problem reports and errors with a note, open until triaged', async () => {
    answerPostHog([
      row(PROBLEM, 'problem_reported', {
        note: 'Export hangs',
        email: 'ana@example.com',
        files: JSON.stringify([FILE_URL])
      }),
      row(ERROR, '$exception', {
        note: 'It crashed when I pasted',
        exceptions: [{ type: 'TypeError', value: 'x is undefined' }]
      })
    ])

    const { reports, truncated } = await inbox()

    expect(truncated).toBe(false)
    expect(reports.map((report) => [report.kind, report.status, report.note])).toEqual([
      ['problem', 'open', 'Export hangs'],
      ['error', 'open', 'It crashed when I pasted']
    ])
    const [problem, error] = reports
    expect(problem?.email).toBe('ana@example.com')
    expect(problem?.receivedAt).toBe('2026-10-19T08:30:00.000Z')
    expect(problem?.files).toEqual([{ name: 'document.fig', url: FILE_URL, expired: false }])
    expect(problem?.filesUnreadable).toBe(false)
    expect(problem?.eventURL).toBe(
      `https://eu.posthog.com/project/267806/events/uuid-1111/${encodeURIComponent('2026-10-19T08:30:00.000Z')}`
    )
    expect(error?.error).toBe('TypeError: x is undefined')
    // Only the range's days, and errors only when their sender wrote something.
    const [sql] = sentQueries()
    expect(sql).toContain("toDate('2026-10-14')")
    expect(sql).toContain("toDate('2026-10-20')")
    expect(sql).toContain('report_note')
  })

  test('marks files retention has deleted, and a file list it cannot read', async () => {
    answerPostHog([
      row(PROBLEM, 'problem_reported', {
        files: [FILE_URL],
        // More than REPORT_FILE_RETENTION_DAYS before NOW.
        receivedAt: '2026-07-01T08:30:00.000Z'
      }),
      row(ERROR, '$exception', { note: 'Crashed', files: '[not json' })
    ])

    const [old, garbled] = (await inbox('2026-07-01', '2026-10-20')).reports

    expect(old?.files).toEqual([{ name: 'document.fig', url: FILE_URL, expired: true }])
    expect(garbled?.files).toEqual([])
    expect(garbled?.filesUnreadable).toBe(true)
  })

  test('says when the range holds more reports than it lists', async () => {
    answerPostHog(
      Array.from({ length: REPORT_INBOX_LIMIT + 1 }, (_, index) =>
        row(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, 'problem_reported')
      )
    )
    const last = `00000000-0000-4000-8000-${String(REPORT_INBOX_LIMIT - 1).padStart(12, '0')}`
    await triage(last, { status: 'closed', note: null })

    const { reports, truncated } = await inbox()
    expect(reports).toHaveLength(REPORT_INBOX_LIMIT)
    expect(truncated).toBe(true)
    // Triage is looked up for every listed report, past D1's 100 parameters per statement.
    expect(reports.at(-1)?.status).toBe('closed')
  })

  test('saves triage with who changed it, and shows it in the inbox', async () => {
    answerPostHog([row(PROBLEM, 'problem_reported', { note: 'Export hangs' })])

    expect((await triage(PROBLEM, { status: 'replied', note: 'Asked for the file' })).status).toBe(
      200
    )
    service.setNow(new Date('2026-10-20T12:30:00.000Z'))
    const saved = await triage(PROBLEM, { status: 'closed', note: '  Fixed in 0.16.1  ' })
    expect(saved.status).toBe(200)
    // The answer is what was saved, so the dashboard shows who changed it without reloading.
    expect(v.parse(reportTriageRecordSchema, await saved.json())).toEqual({
      status: 'closed',
      triageNote: 'Fixed in 0.16.1',
      handledBy: 'dan@example.com',
      handledAt: '2026-10-20T12:30:00.000Z'
    })

    const [report] = (await inbox()).reports
    expect(report).toMatchObject({
      status: 'closed',
      triageNote: 'Fixed in 0.16.1',
      handledBy: 'dan@example.com',
      handledAt: '2026-10-20T12:30:00.000Z'
    })
  })

  test('refuses triage without Access, with an unknown status, or for a malformed ID', async () => {
    expect((await triage(PROBLEM, { status: 'closed', note: null }, false)).status).toBe(403)
    expect((await triage(PROBLEM, { status: 'done', note: null })).status).toBe(400)
    expect((await triage('not-a-report', { status: 'closed', note: null })).status).toBe(404)
  })

  test('refuses the inbox without Access', async () => {
    const response = await service.request('/admin/api/reports?start=2026-10-14&end=2026-10-20')
    expect(response.status).toBe(403)
  })
})

describe('report detail', () => {
  /** PostHog answers the detail's report query, then its steps query with `steps`. */
  function answerDetail(steps: unknown) {
    service.respond(POSTHOG_QUERY, (call) => {
      const sql = String(call.init?.body)
      if (sql.includes('report_steps')) return Response.json({ results: [[steps]] })
      return Response.json({
        results: [row(PROBLEM, 'problem_reported', { note: 'Export hangs' })]
      })
    })
  }

  const STEP = {
    $message: 'document.opened',
    $timestamp: '2026-10-19T08:29:00.000Z',
    category: 'document',
    level: 'info'
  }

  test('shows the steps that led up to the report', async () => {
    answerDetail(JSON.stringify([STEP]))

    const { status, report } = await detail(PROBLEM)

    expect(status).toBe(200)
    expect(report?.note).toBe('Export hangs')
    expect(report?.stepsUnreadable).toBe(false)
    expect(report?.steps).toEqual([
      {
        name: 'document.opened',
        category: 'document',
        level: 'info',
        timestamp: '2026-10-19T08:29:00.000Z'
      }
    ])
    // The ID reaches the query only after it was checked to be a UUID.
    expect(sentQueries().every((sql) => sql.includes(`'${PROBLEM}'`))).toBe(true)
  })

  test('says the steps could not be read rather than showing some of them', async () => {
    answerDetail([STEP, { not: 'a step' }])

    const { report } = await detail(PROBLEM)

    expect(report?.steps).toEqual([])
    expect(report?.stepsUnreadable).toBe(true)
  })

  test('answers 404 for a report PostHog does not have, or a malformed ID', async () => {
    answerPostHog([])
    expect((await detail(PROBLEM)).status).toBe(404)
    expect((await detail("x' OR 1=1 --")).status).toBe(404)
  })
})
