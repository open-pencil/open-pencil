import { expect, test } from 'bun:test'

import { createFeedbackClient } from '@open-pencil/feedback/client'
import type { Report } from '@open-pencil/feedback/contract'

import { sendReport } from '@/app/reports/send'

const REPORT: Report = {
  kind: 'problem',
  version: '0.17.0',
  platform: 'macos',
  arch: 'arm64',
  app: 'desktop',
  browser: 'unknown',
  note: 'Text jumps on resize',
  files: [{ name: 'document.fig', size: 3 }]
}
const REPORT_ID = '6f1c1f9e-7b8a-4c7d-9e3f-2a1b0c9d8e7f'
const FILE = { name: 'document.fig' as const, bytes: new Uint8Array([1, 2, 3]) }

interface Sent {
  method: string
  path: string
  authorization: string | null
  body: Uint8Array
}

/** A client whose requests the test answers, recording what each carried. */
function fakeService(answer: (request: Request) => Response) {
  const sent: Sent[] = []
  const client = createFeedbackClient({
    origin: 'https://feedback.test',
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        body: new Uint8Array(await request.clone().arrayBuffer())
      })
      return answer(request)
    }
  })
  return { client, sent }
}

const receipt = (uploadToken: string | null) =>
  Response.json({ reportId: REPORT_ID, uploadToken }, { status: 201 })

test('sends the report, then each file with its upload token', async () => {
  const { client, sent } = fakeService((request) =>
    request.method === 'POST' ? receipt('token') : new Response(null, { status: 204 })
  )

  expect(await sendReport(REPORT, [FILE], client)).toEqual({ ok: true, reportId: REPORT_ID })
  expect(sent.map(({ method, path }) => `${method} ${path}`)).toEqual([
    'POST /reports',
    `PUT /reports/${REPORT_ID}/files/document.fig`
  ])
  expect(sent[1].authorization).toBe('Bearer token')
  expect([...sent[1].body]).toEqual([1, 2, 3])
})

test('a refused report sends no files', async () => {
  const { client, sent } = fakeService(() => new Response(null, { status: 502 }))

  expect(await sendReport(REPORT, [FILE], client)).toEqual({
    ok: false,
    failure: 'report',
    reportId: null
  })
  expect(sent).toHaveLength(1)
})

test('a failed upload keeps the delivered report’s ID', async () => {
  const { client } = fakeService((request) =>
    request.method === 'POST' ? receipt('token') : new Response(null, { status: 403 })
  )

  expect(await sendReport(REPORT, [FILE], client)).toEqual({
    ok: false,
    failure: 'files',
    reportId: REPORT_ID
  })
})
