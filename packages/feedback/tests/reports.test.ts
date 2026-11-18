import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { signAccessToken, trustAccessKey } from '#feedback-tests/access'
import { createTestService, type TestService } from '#feedback-tests/harness'
import { reportReceiptSchema, type Report } from '#feedback/contract'
import { deleteExpiredReportFiles, reportFileKey } from '#feedback/reports/files'
import { runRetention } from '#feedback/retention'
import type { CryptoKey } from 'jose'
import * as v from 'valibot'

let service: TestService
let signingKey: CryptoKey

const NOW = new Date('2026-11-03T10:00:00.000Z')
const RELEASE = '01a19e69-fdef-0000-e554-4733f3a5a77c'
const CHUNK = '849ab7be-6ab8-5c38-8851-ee4992cad3e5'

const BUILD = {
  version: '0.17.0',
  platform: 'macos',
  arch: 'arm64',
  app: 'desktop',
  browser: 'unknown'
} as const

const ERROR_REPORT: Report = {
  kind: 'error',
  ...BUILD,
  release: RELEASE,
  exceptions: [
    {
      type: 'TypeError',
      value: 'nodes.map is not a function',
      mechanism: { handled: false, synthetic: false, type: 'window' },
      stacktrace: {
        type: 'raw',
        frames: [
          {
            platform: 'web:javascript',
            filename: 'tauri://localhost/assets/index-a1b2c3d4.js',
            function: 'Le',
            lineno: 1,
            colno: 52114,
            in_app: true,
            chunk_id: CHUNK
          }
        ]
      }
    }
  ],
  steps: [
    {
      name: 'document.operation.failed',
      category: 'document',
      level: 'error',
      timestamp: '2026-11-03T09:59:58.000Z',
      attributes: { operation: 'open', format: 'fig', durationMs: 120 }
    }
  ]
}

const PROBLEM_REPORT: Report = {
  kind: 'problem',
  ...BUILD,
  note: 'Text jumps when I resize the frame.',
  email: 'reporter@example.com',
  files: [{ name: 'document.fig', size: 5 }]
}

const postHogBodySchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    api_key: v.string(),
    batch: v.tuple([
      v.object({
        event: v.string(),
        timestamp: v.string(),
        distinct_id: v.string(),
        properties: v.record(v.string(), v.unknown())
      })
    ])
  })
)

/** The event the last report sent to PostHog. */
function sentEvent() {
  const call = service.fetchCalls.at(-1)
  expect(call?.url).toBe('https://eu.i.posthog.com/batch/')
  return v.parse(postHogBodySchema, call?.init?.body).batch[0]
}

async function submit(report: unknown) {
  const response = await service.postJSON('/reports', report, { 'CF-Connecting-IP': '203.0.113.7' })
  const receipt =
    response.status === 201 ? v.parse(reportReceiptSchema, await response.json()) : null
  return { status: response.status, receipt }
}

function upload(reportId: string, name: string, body: string, token: string | null) {
  return service.request(`/reports/${reportId}/files/${name}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body
  })
}

beforeAll(async () => {
  service = await createTestService()
  signingKey = (await trustAccessKey(service)).signingKey
})

beforeEach(() => {
  service.fetchCalls.length = 0
  service.limiters.report.exhausted = false
  service.setNow(NOW)
})

afterAll(async () => {
  await service.dispose()
})

describe('error reports', () => {
  test('go to PostHog error tracking as one exception, without a person or an address', async () => {
    const { status, receipt } = await submit(ERROR_REPORT)

    expect(status).toBe(201)
    if (!receipt) throw new Error('The report was not accepted')
    expect(receipt.uploadToken).toBeNull()
    const event = sentEvent()
    expect(event.event).toBe('$exception')
    expect(event.timestamp).toBe(NOW.toISOString())
    // No install ID was sent, so the report is its own PostHog person.
    expect(event.distinct_id).toBe(receipt.reportId)
    expect(event.properties).toEqual({
      ...BUILD,
      report_id: receipt.reportId,
      report_note: null,
      report_email: null,
      report_files: [],
      $release_id: RELEASE,
      $exception_list: ERROR_REPORT.kind === 'error' ? ERROR_REPORT.exceptions : [],
      $exception_level: 'error',
      $exception_steps: [
        {
          $message: 'document.operation.failed',
          $timestamp: '2026-11-03T09:59:58.000Z',
          category: 'document',
          level: 'error',
          attribute_operation: 'open',
          attribute_format: 'fig',
          attribute_durationMs: 120
        }
      ],
      $lib: 'openpencil',
      $process_person_profile: false,
      $geoip_disable: true
    })
    expect(JSON.stringify(event)).not.toContain('203.0.113.7')
  })

  test('join the install’s usage events when it shares usage stats', async () => {
    const installId = '0123456789abcdef0123456789abcdef'
    await submit({ ...ERROR_REPORT, installId })
    expect(sentEvent().distinct_id).toBe(installId)
  })

  test.each([
    ['no exception', { ...ERROR_REPORT, exceptions: [] }],
    ['an unknown field', { ...ERROR_REPORT, fileName: 'Client roadmap.fig' }],
    [
      'a frame from another platform',
      {
        ...ERROR_REPORT,
        exceptions: [
          {
            type: 'Error',
            mechanism: { handled: false, synthetic: false, type: 'window' },
            stacktrace: { type: 'raw', frames: [{ platform: 'python' }] }
          }
        ]
      }
    ],
    ['a file under its own name', { ...ERROR_REPORT, files: [{ name: 'Roadmap.fig', size: 5 }] }],
    [
      'a file the app never sends',
      { ...ERROR_REPORT, files: [{ name: 'customer-data.txt', size: 5 }] }
    ]
  ])('refuse a report with %s', async (_scenario, report) => {
    expect((await submit(report)).status).toBe(400)
    expect(service.fetchCalls).toHaveLength(0)
  })

  test('report a PostHog failure and hand out no upload token', async () => {
    service.respond('https://eu.i.posthog.com', () => new Response(null, { status: 503 }))
    try {
      const { status, receipt } = await submit(PROBLEM_REPORT)
      expect(status).toBe(502)
      expect(receipt).toBeNull()
    } finally {
      service.respond('https://eu.i.posthog.com', () => new Response(null, { status: 200 }))
    }
  })

  test('take a body larger than the other routes allow', async () => {
    const note = 'x'.repeat(4000)
    const steps = Array.from({ length: 50 }, (_, index) => ({
      name: 'runtime.error',
      category: 'runtime',
      level: 'error',
      timestamp: '2026-11-03T09:59:58.000Z',
      attributes: { stack: `frame ${index}\n`.repeat(20) }
    }))
    const report = { ...ERROR_REPORT, note, steps }
    expect(JSON.stringify(report).length).toBeGreaterThan(16 * 1024)
    expect((await submit(report)).status).toBe(201)
  })

  test('count against the report rate limit', async () => {
    service.limiters.report.exhausted = true
    expect((await submit(ERROR_REPORT)).status).toBe(429)
  })
})

describe('problem reports', () => {
  test('go to PostHog with the note, the email, and links to their files', async () => {
    const { receipt } = await submit(PROBLEM_REPORT)

    const event = sentEvent()
    expect(event.event).toBe('problem_reported')
    expect(event.properties.report_note).toBe(PROBLEM_REPORT.note)
    expect(event.properties.report_email).toBe('reporter@example.com')
    expect(event.properties.report_files).toEqual([
      `https://feedback.openpencil.dev/admin/reports/${receipt?.reportId}/files/document.fig`
    ])
    expect(event.properties).not.toHaveProperty('$exception_list')
  })

  test('need a note', async () => {
    expect((await submit({ ...PROBLEM_REPORT, note: '  ' })).status).toBe(400)
  })
})

describe('report files', () => {
  async function submitted() {
    const { receipt } = await submit(PROBLEM_REPORT)
    if (!receipt?.uploadToken) throw new Error('The report answered without an upload token')
    return { reportId: receipt.reportId, token: receipt.uploadToken }
  }

  test('upload once with the report’s token and download only through Access', async () => {
    const { reportId, token } = await submitted()

    expect((await upload(reportId, 'document.fig', 'bytes', token)).status).toBe(204)

    const path = `/admin/reports/${reportId}/files/document.fig`
    expect((await service.request(path)).status).toBe(403)
    const download = await service.request(path, {
      headers: { 'cf-access-jwt-assertion': await signAccessToken(signingKey, NOW) }
    })
    expect(download.status).toBe(200)
    expect(download.headers.get('content-disposition')).toBe(
      `attachment; filename="${reportId}-document.fig"`
    )
    expect(download.headers.get('cache-control')).toBe('private, no-store')
    expect(await download.text()).toBe('bytes')
  })

  test('refuse a file the service does not take, at another size, or for another report', async () => {
    const { reportId, token } = await submitted()
    const other = await submitted()

    expect((await upload(reportId, 'screenshot.png', 'bytes', token)).status).toBe(403)
    expect((await upload(reportId, 'document.fig', 'more bytes', token)).status).toBe(400)
    expect((await upload(other.reportId, 'document.fig', 'bytes', token)).status).toBe(403)
    expect((await upload(reportId, 'document.fig', 'bytes', null)).status).toBe(403)
    expect(await service.env.REPORTS.head(reportFileKey(reportId, 'document.fig'))).toBeNull()
  })

  test('refuse an upload token after its hour', async () => {
    const { reportId, token } = await submitted()
    service.setNow(new Date(NOW.getTime() + 61 * 60 * 1000))
    expect((await upload(reportId, 'document.fig', 'bytes', token)).status).toBe(403)
  })

  test('are deleted by retention after 90 days', async () => {
    const { reportId, token } = await submitted()
    await upload(reportId, 'document.fig', 'bytes', token)
    const key = reportFileKey(reportId, 'document.fig')
    const day = 24 * 60 * 60 * 1000

    await deleteExpiredReportFiles(service.env.REPORTS, new Date(Date.now() + 89 * day))
    expect(await service.env.REPORTS.head(key)).not.toBeNull()
    await deleteExpiredReportFiles(service.env.REPORTS, new Date(Date.now() + 91 * day))
    expect(await service.env.REPORTS.head(key)).toBeNull()
  })

  test('are deleted by retention even when the sign-up cleanup fails', async () => {
    const { reportId, token } = await submitted()
    await upload(reportId, 'document.fig', 'bytes', token)
    const key = reportFileKey(reportId, 'document.fig')
    const failingDatabase = new Proxy(service.env.DB, {
      get: (database, key) =>
        key === 'prepare'
          ? () => {
              throw new Error('D1 is unavailable')
            }
          : Reflect.get(database, key)
    })
    const env = { ...service.env, DB: failingDatabase }

    await expect(
      runRetention(env, new Date(Date.now() + 91 * 24 * 60 * 60 * 1000))
    ).rejects.toThrow('D1 is unavailable')
    expect(await service.env.REPORTS.head(key)).toBeNull()
  })
})

test('other routes keep the small body limit', async () => {
  const response = await service.postJSON('/ping', { padding: 'x'.repeat(20 * 1024) })
  expect(response.status).toBe(413)
})
