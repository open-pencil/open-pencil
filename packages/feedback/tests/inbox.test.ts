import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { signAccessToken, trustAccessKey } from '#feedback-tests/access'
import { createTestService, type TestService } from '#feedback-tests/harness'
import {
  REPORT_INBOX_PAGE_SIZE,
  reportDetailSchema,
  reportInboxSchema,
  reportTriageRecordSchema,
  type ReportDetail,
  type ReportInbox
} from '#feedback/contract'
import { reportFileKey } from '#feedback/reports/files'
import { zipSync } from 'fflate'
import type { CryptoKey } from 'jose'
import { toUint8Array } from 'js-base64'
import * as v from 'valibot'

let service: TestService
let signingKey: CryptoKey

const POSTHOG_QUERY = 'https://eu.posthog.com/api/projects/267806/query/'
const POSTHOG_CAPTURE = 'https://eu.i.posthog.com/batch/'
const NOW = new Date('2026-10-20T12:00:00.000Z')
const PROBLEM = '11111111-1111-4111-8111-111111111111'
const ERROR = '22222222-2222-4222-8222-222222222222'
const EVENT = '33333333-3333-4333-8333-333333333333'
const FILE_URL = `https://feedback.openpencil.dev/admin/reports/${PROBLEM}/files/document.fig`
const RECEIVED = Date.parse('2026-10-19T08:30:00.000Z')
// A 2×2 PNG, the smallest image the thumbnail reader takes for a preview.
const PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP4z8DwH4QZYAwAR8oH+WdZbrcAAAAASUVORK5CYII='
)

/** A report row as PostHog's query API answers the inbox's columns, triage joined. */
function row(
  reportId: string,
  event: 'problem_reported' | '$exception',
  extra: {
    uuid?: string
    received?: number
    note?: string | null
    email?: string | null
    files?: unknown
    exceptions?: unknown
    status?: string
    triageNote?: string
    handledBy?: string
    handledAt?: number
  } = {}
) {
  return [
    extra.uuid ?? EVENT,
    event,
    extra.received ?? RECEIVED,
    reportId,
    extra.note ?? null,
    extra.email ?? null,
    '0.16.0',
    'macos',
    'arm64',
    'desktop',
    'unknown',
    extra.files ?? null,
    extra.exceptions ?? null,
    // The join's empty side reads as empty strings, as ClickHouse fills it.
    extra.status ?? '',
    extra.triageNote ?? '',
    extra.handledBy ?? '',
    extra.handledAt ?? 0
  ]
}

const querySchema = v.object({
  query: v.object({
    query: v.string(),
    values: v.optional(v.record(v.string(), v.union([v.string(), v.number()])))
  })
})
/** The HogQL queries the service sent, with the values PostHog binds into them. */
const sentQueries = () =>
  service.fetchCalls
    .filter((call) => call.url === POSTHOG_QUERY)
    .map(
      (call) =>
        v.parse(v.pipe(v.string(), v.parseJson(), querySchema), String(call.init?.body)).query
    )

/** PostHog answers counts with `counts` and everything else with `rows`. */
function answerPostHog(rows: unknown[][], counts: [string, number][] = []) {
  service.respond(POSTHOG_QUERY, (call) => {
    const sql = String(call.init?.body)
    return Response.json({ results: sql.includes('GROUP BY status') ? counts : rows })
  })
}

const headers = async () => ({ 'cf-access-jwt-assertion': await signAccessToken(signingKey, NOW) })

async function inbox(query: Record<string, string> = {}): Promise<ReportInbox> {
  const response = await service.request(`/admin/api/reports?${new URLSearchParams(query)}`, {
    headers: await headers()
  })
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
  // Published once: the service keeps Access's keys for a while, as Cloudflare rotates them.
  signingKey = (await trustAccessKey(service)).signingKey
})

beforeEach(() => {
  // Each test answers PostHog for itself; answering a URL again replaces the last answer.
  service.respond(POSTHOG_QUERY, () => Response.json({ results: [] }))
  service.respond(POSTHOG_CAPTURE, () => Response.json({ status: 1 }))
  service.fetchCalls.length = 0
  service.setNow(NOW)
})

afterAll(async () => {
  await service.dispose()
})

describe('report inbox', () => {
  test('lists open reports with their triage, and counts every filter', async () => {
    answerPostHog(
      [
        row(PROBLEM, 'problem_reported', {
          note: 'Export hangs',
          email: 'ana@example.com',
          files: JSON.stringify([FILE_URL])
        }),
        row(ERROR, '$exception', {
          note: 'It crashed when I pasted',
          exceptions: [{ type: 'TypeError', value: 'x is undefined' }],
          status: 'replied',
          triageNote: 'Asked for the file',
          handledBy: 'dan@example.com',
          handledAt: Date.parse('2026-10-19T10:00:00.000Z')
        })
      ],
      [
        ['open', 7],
        ['replied', 2],
        ['', 1]
      ]
    )

    const page = await inbox()

    expect(page.next).toBeNull()
    expect(page.counts).toEqual({ open: 8, replied: 2, closed: 0, all: 10 })
    const [problem, error] = page.reports
    expect(problem).toMatchObject({
      kind: 'problem',
      status: 'open',
      email: 'ana@example.com',
      receivedAt: '2026-10-19T08:30:00.000Z',
      files: [{ name: 'document.fig', url: FILE_URL, expired: false }],
      handledBy: null
    })
    expect(error).toMatchObject({
      kind: 'error',
      status: 'replied',
      error: 'TypeError: x is undefined',
      triageNote: 'Asked for the file',
      handledBy: 'dan@example.com',
      handledAt: '2026-10-19T10:00:00.000Z'
    })
    // Open by default, across all time: the filter is bound, and no day range narrows it.
    const [list] = sentQueries()
    expect(list?.values).toEqual({ status: 'open' })
    expect(list?.query).not.toContain('toDate(')
    expect(list?.query).toContain('report_triaged')
  })

  test('pages with a cursor of time and event, and counts only on the first page', async () => {
    const id = (index: number) => String(index).padStart(12, '0')
    answerPostHog(
      Array.from({ length: REPORT_INBOX_PAGE_SIZE + 1 }, (_, index) =>
        row(`00000000-0000-4000-8000-${id(index)}`, 'problem_reported', {
          uuid: `aaaaaaaa-0000-4000-8000-${id(index)}`,
          received: RECEIVED - index * 1000
        })
      )
    )
    const first = await inbox({ filter: 'all' })
    expect(first.reports).toHaveLength(REPORT_INBOX_PAGE_SIZE)
    const last = REPORT_INBOX_PAGE_SIZE - 1
    const cursor = `${RECEIVED - last * 1000}:aaaaaaaa-0000-4000-8000-${id(last)}`
    expect(first.next).toBe(cursor)

    service.fetchCalls.length = 0
    const second = await inbox({ filter: 'all', after: cursor })
    expect(second.counts).toBeNull()
    expect(sentQueries()).toHaveLength(1)
    expect(sentQueries()[0]?.values).toEqual({
      after_ms: RECEIVED - last * 1000,
      after_uuid: `aaaaaaaa-0000-4000-8000-${id(last)}`
    })
  })

  test('binds a search as a value, its wildcards taken literally', async () => {
    answerPostHog([])
    await inbox({ search: "50% off_' OR 1=1 --" })
    const queries = sentQueries()
    expect(queries).toHaveLength(2)
    for (const query of queries) {
      expect(query.query).not.toContain('OR 1=1')
      expect(query.values?.pattern).toBe("%50\\% off\\_' OR 1=1 --%")
    }
  })

  test('marks files retention has deleted, and a file list it cannot read', async () => {
    answerPostHog([
      row(PROBLEM, 'problem_reported', {
        files: [FILE_URL],
        received: Date.parse('2026-07-01T08:30:00.000Z')
      }),
      row(ERROR, '$exception', { note: 'Crashed', files: '[not json' })
    ])
    const [old, garbled] = (await inbox({ filter: 'all' })).reports
    expect(old?.files).toEqual([{ name: 'document.fig', url: FILE_URL, expired: true }])
    expect(garbled?.files).toEqual([])
    expect(garbled?.filesUnreadable).toBe(true)
  })

  test('refuses the inbox without Access, or with an unknown filter', async () => {
    expect((await service.request('/admin/api/reports')).status).toBe(403)
    const unknown = await service.request('/admin/api/reports?filter=spam', {
      headers: await headers()
    })
    expect(unknown.status).toBe(400)
  })
})

describe('report triage', () => {
  test('records triage in PostHog as the team, with who changed it', async () => {
    service.respond(POSTHOG_CAPTURE, () => Response.json({ status: 1 }))

    const saved = await triage(PROBLEM, { status: 'closed', note: '  Fixed in 0.16.1  ' })

    expect(saved.status).toBe(200)
    expect(v.parse(reportTriageRecordSchema, await saved.json())).toEqual({
      status: 'closed',
      triageNote: 'Fixed in 0.16.1',
      handledBy: 'dan@example.com',
      handledAt: NOW.toISOString()
    })
    const capture = service.fetchCalls.find((call) => call.url === POSTHOG_CAPTURE)
    const body = v.parse(
      v.pipe(
        v.string(),
        v.parseJson(),
        v.object({ batch: v.array(v.record(v.string(), v.unknown())) })
      ),
      String(capture?.init?.body)
    )
    expect(body.batch[0]).toMatchObject({
      event: 'report_triaged',
      distinct_id: 'openpencil-team',
      properties: {
        report_id: PROBLEM,
        status: 'closed',
        triage_note: 'Fixed in 0.16.1',
        handled_by: 'dan@example.com',
        $process_person_profile: false
      }
    })
  })

  test('refuses triage without Access, with an unknown status, or for a malformed ID', async () => {
    expect((await triage(PROBLEM, { status: 'closed', note: null }, false)).status).toBe(403)
    expect((await triage(PROBLEM, { status: 'done', note: null })).status).toBe(400)
    expect((await triage('not-a-report', { status: 'closed', note: null })).status).toBe(404)
  })
})

describe('report detail', () => {
  /** PostHog answers the detail query with a report row, its steps, and its issue. */
  function answerDetail(steps: unknown, exceptions: unknown = null, issue: string | null = null) {
    service.respond(POSTHOG_QUERY, () =>
      Response.json({
        results: [
          [...row(ERROR, '$exception', { note: 'Crashed on paste', exceptions }), steps, issue]
        ]
      })
    )
  }

  test('shows the exception with the most recent call first, symbolicated or raw', async () => {
    answerDetail(
      [],
      [
        {
          type: 'TypeError',
          value: "Cannot read properties of undefined (reading 'children')",
          mechanism: { handled: false, type: 'window' },
          stacktrace: {
            type: 'resolved',
            frames: [
              {
                filename: 'https://app.openpencil.dev/assets/index.js',
                function: 'n',
                lineno: 1,
                colno: 9,
                in_app: false
              },
              {
                source: 'src/app/clipboard/paste.ts',
                resolved_name: 'pasteFromFigma',
                line: 88,
                column: 5,
                in_app: true,
                resolved: true
              }
            ]
          }
        }
      ],
      '0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000'
    )

    const { report } = await detail(ERROR)

    expect(report?.exceptions).toEqual([
      {
        type: 'TypeError',
        message: "Cannot read properties of undefined (reading 'children')",
        handled: false,
        source: 'window',
        frames: [
          {
            function: 'pasteFromFigma',
            file: 'src/app/clipboard/paste.ts',
            line: 88,
            column: 5,
            inApp: true,
            resolved: true
          },
          {
            function: 'n',
            file: 'https://app.openpencil.dev/assets/index.js',
            line: 1,
            column: 9,
            inApp: false,
            resolved: false
          }
        ]
      }
    ])
    expect(report?.issueURL).toBe(
      'https://eu.posthog.com/project/267806/error_tracking/0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000'
    )
    // The report ID reaches the query as a bound value.
    expect(sentQueries()[0]?.values).toEqual({ report_id: ERROR })
  })

  test('shows each step with what it recorded', async () => {
    answerDetail(
      JSON.stringify([
        {
          $message: 'document.opened',
          $timestamp: '2026-10-19T08:29:00.000Z',
          category: 'document',
          level: 'info',
          attribute_format: 'fig',
          attribute_bytes: 2048,
          attribute_cloud: false
        }
      ])
    )
    const { report } = await detail(ERROR)
    expect(report?.steps).toEqual([
      {
        name: 'document.opened',
        category: 'document',
        level: 'info',
        timestamp: '2026-10-19T08:29:00.000Z',
        attributes: { format: 'fig', bytes: 2048, cloud: false }
      }
    ])
  })

  test('says the steps could not be read rather than showing some of them', async () => {
    answerDetail([{ $message: 'document.opened' }, { not: 'a step' }])
    const { report } = await detail(ERROR)
    expect(report?.steps).toEqual([])
    expect(report?.stepsUnreadable).toBe(true)
  })

  test('answers 404 for a report PostHog does not have, or a malformed ID', async () => {
    service.respond(POSTHOG_QUERY, () => Response.json({ results: [] }))
    expect((await detail(PROBLEM)).status).toBe(404)
    expect((await detail("x' OR 1=1 --")).status).toBe(404)
  })
})

describe('report thumbnail', () => {
  test('serves the thumbnail an attached document carries', async () => {
    await service.env.REPORTS.put(
      reportFileKey(PROBLEM, 'document.fig'),
      zipSync({ 'canvas.fig': new Uint8Array([1, 2, 3]), 'thumbnail.png': PNG }).slice().buffer
    )
    const response = await service.request(
      `/admin/reports/${PROBLEM}/files/document.fig/thumbnail`,
      { headers: await headers() }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...PNG])
  })

  test('answers 404 for a document that is gone', async () => {
    const response = await service.request(`/admin/reports/${ERROR}/files/document.fig/thumbnail`, {
      headers: await headers()
    })
    expect(response.status).toBe(404)
  })
})
