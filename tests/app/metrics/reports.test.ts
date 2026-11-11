import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

import type { MetricsRange } from '@/app/metrics/range'
import { reportInboxPage, useReportInbox, useReportTriage } from '@/app/metrics/reports'

function report(id: string, status: ReportStatus, fields: Partial<InboxReport> = {}): InboxReport {
  return {
    id,
    kind: 'problem',
    receivedAt: '2026-11-11T09:00:00.000Z',
    note: null,
    email: null,
    version: '0.16.0',
    platform: 'macos',
    arch: 'arm64',
    app: 'desktop',
    browser: 'unknown',
    error: null,
    files: [],
    filesUnreadable: false,
    eventURL: '',
    status,
    triageNote: null,
    handledBy: null,
    handledAt: null,
    ...fields
  }
}

const REPORTS = [
  report('a', 'open', { note: 'PDF export hangs' }),
  report('b', 'open', { kind: 'error', error: 'TypeError: x is undefined', platform: 'windows' }),
  report('c', 'replied', { note: 'Export to SVG loses gradients', email: 'lee@example.com' }),
  report('d', 'closed', { note: 'Fonts missing' })
]

const page = (request: Partial<Parameters<typeof reportInboxPage>[1]>) =>
  reportInboxPage(REPORTS, { filter: 'all', limit: 50, offset: 0, ...request })

describe('report inbox page', () => {
  test('lists the reports under a status, with how many each status holds', () => {
    const open = page({ filter: 'open' })
    expect(open.rows.map((row) => row.id)).toEqual(['a', 'b'])
    expect(open.total).toBe(2)
    expect(open.counts).toEqual({ all: 4, open: 2, replied: 1, closed: 1 })
  })

  test('searches every word across the note, address, error, and build', () => {
    expect(page({ search: 'export' }).rows.map((row) => row.id)).toEqual(['a', 'c'])
    expect(page({ search: 'EXPORT lee@' }).rows.map((row) => row.id)).toEqual(['c'])
    expect(page({ search: 'typeerror windows' }).rows.map((row) => row.id)).toEqual(['b'])
    // Counts follow the search, so each filter says how many of the matches it holds.
    expect(page({ search: 'export' }).counts).toEqual({ all: 2, open: 1, replied: 1, closed: 0 })
  })

  test('pages through the matches', () => {
    const second = page({ limit: 2, offset: 2 })
    expect(second.rows.map((row) => row.id)).toEqual(['c', 'd'])
    expect(second.total).toBe(4)
  })
})

/** A report ID as the contract requires one. */
const A = '11111111-1111-4111-8111-111111111111'

/** A request to the dashboard's API, answered when the test says so. */
type Pending = { url: string; method: string; answer: (response: Response) => void }

const pending: Pending[] = []
const saved = new Map<string, PropertyDescriptor | undefined>()

beforeAll(() => {
  for (const name of ['location', 'fetch'] as const)
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin: 'https://feedback.openpencil.dev' }
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        const request = input instanceof Request ? input : new Request(input, init)
        pending.push({ url: request.url, method: request.method, answer: resolve })
      })
  })
})

afterAll(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

/** The oldest request still waiting whose URL holds `part`. */
function take(part: string): Pending {
  const index = pending.findIndex((request) => request.url.includes(part))
  const [request] = pending.splice(index, 1)
  if (!request) throw new Error(`No request for ${part}`)
  return request
}

/** Lets awaited responses and Vue's watchers run. */
const settle = async () => {
  for (let step = 0; step < 5; step++) {
    await nextTick()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

const RANGE: MetricsRange = { preset: '7d', start: '2026-11-05', end: '2026-11-11' }

describe('report inbox state', () => {
  test('keeps a status saved while an older load was still on its way', async () => {
    const range = ref(RANGE)
    const inbox = useReportInbox(range)
    const first = inbox.refresh()
    take('/admin/api/reports?').answer(
      Response.json({ reports: [report(A, 'open')], truncated: false })
    )
    await first

    // A refresh reads the triage, then the team closes the report before its answer arrives.
    const refreshing = inbox.refresh()
    const save = inbox.update(A, { status: 'closed', note: null })
    take('/triage').answer(
      Response.json({
        status: 'closed',
        triageNote: null,
        handledBy: 'dan@example.com',
        handledAt: '2026-11-11T10:00:00.000Z'
      })
    )
    await save
    take('/admin/api/reports?').answer(
      Response.json({ reports: [report(A, 'open')], truncated: false })
    )
    await refreshing

    expect(inbox.reports.value[0]).toMatchObject({ status: 'closed', handledBy: 'dan@example.com' })
  })

  test("clears another range's reports when the new range fails, but keeps them on a failed refresh", async () => {
    const range = ref(RANGE)
    const inbox = useReportInbox(range)
    const first = inbox.refresh()
    take('/admin/api/reports?').answer(
      Response.json({ reports: [report(A, 'open')], truncated: false })
    )
    await first

    const again = inbox.refresh()
    take('/admin/api/reports?').answer(new Response(null, { status: 502 }))
    await again
    expect(inbox.failed.value).toBe(true)
    expect(inbox.reports.value.map((each) => each.id)).toEqual([A])

    range.value = { preset: '30d', start: '2026-10-13', end: '2026-11-11' }
    await settle()
    take('/admin/api/reports?').answer(new Response(null, { status: 502 }))
    await settle()
    expect(inbox.reports.value).toEqual([])
    expect(inbox.loaded.value).toBe(false)
  })

  test('shows the steps of the latest opening when the same report is reopened', async () => {
    const triage = useReportTriage({ update: async () => null })
    const opened = report(A, 'open')
    const older = triage.open(opened)
    const newer = triage.open(opened)
    const [olderRequest, newerRequest] = [
      take(`/admin/api/reports/${A}`),
      take(`/admin/api/reports/${A}`)
    ]
    newerRequest.answer(Response.json({ ...opened, steps: [], stepsUnreadable: false }))
    await newer
    olderRequest.answer(new Response(null, { status: 502 }))
    await older

    expect(triage.detail.value?.id).toBe(A)
    expect(triage.detailFailed.value).toBe(false)
  })
})
