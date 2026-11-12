import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { nextTick, shallowRef } from 'vue'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

import { useReportInbox, useReportTriage } from '@/app/metrics/reports'

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

/** Report IDs as the contract requires them. */
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

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

// A request one test left waiting never answers another's.
beforeEach(() => {
  pending.length = 0
})

afterAll(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

/** The oldest request whose URL holds `part`, once the code under test has sent it. */
async function take(part: string): Promise<Pending> {
  for (let tick = 0; tick < 20; tick++) {
    const index = pending.findIndex((request) => request.url.includes(part))
    if (index !== -1) {
      const [request] = pending.splice(index, 1)
      if (request) return request
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  throw new Error(`No request for ${part}; waiting: ${pending.map((each) => each.url).join(', ')}`)
}

/** Answers the oldest request whose URL holds `part`. */
async function answer(part: string, response: Response): Promise<void> {
  ;(await take(part)).answer(response)
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

/** Where a page ends, as the server writes it: Unix milliseconds and the event's UUID. */
const CURSOR = `1762851600000:${C}`
const COUNTS = { open: 2, replied: 0, closed: 0, all: 2 }
const page = (reports: InboxReport[], next: string | null = null, counts: unknown = COUNTS) =>
  Response.json({ reports, next, counts })
const SAVED = {
  status: 'closed',
  triageNote: null,
  handledBy: 'dan@example.com',
  handledAt: '2026-11-11T10:00:00.000Z'
}

describe('report inbox state', () => {
  test('keeps saved triage over a load that read PostHog before it took the triage in', async () => {
    const inbox = useReportInbox()
    const first = inbox.refresh()
    await answer('/admin/api/reports?', page([report(A, 'open'), report(B, 'open')]))
    await first

    const save = inbox.update(A, { status: 'closed', note: null })
    await answer('/triage', Response.json(SAVED))
    await save
    // The counts follow the status that moved.
    expect(inbox.counts.value).toEqual({ open: 1, replied: 0, closed: 1, all: 2 })

    const refreshing = inbox.refresh()
    await answer('/admin/api/reports?', page([report(A, 'open'), report(B, 'open')]))
    await refreshing

    expect(inbox.reports.value[0]).toMatchObject({ status: 'closed', handledBy: 'dan@example.com' })
  })

  test('appends the next page once, and starts over for another filter', async () => {
    const inbox = useReportInbox()
    const first = inbox.refresh()
    const asked = await take('/admin/api/reports?')
    expect(new URL(asked.url).searchParams.get('filter')).toBe('open')
    asked.answer(page([report(A, 'open'), report(B, 'open')], CURSOR))
    await first

    const more = inbox.loadMore()
    // A second scroll to the end while a page loads asks for nothing more.
    void inbox.loadMore()
    const next = await take('/admin/api/reports?')
    expect(new URL(next.url).searchParams.get('after')).toBe(CURSOR)
    expect(pending.filter((request) => request.url.includes('/admin/api/reports?'))).toEqual([])
    next.answer(page([report(B, 'open'), report(C, 'open')], null, null))
    await more
    expect(inbox.reports.value.map((each) => each.id)).toEqual([A, B, C])
    expect(inbox.next.value).toBeNull()

    inbox.filter.value = 'closed'
    await settle()
    const closed = await take('/admin/api/reports?')
    expect(new URL(closed.url).searchParams.get('filter')).toBe('closed')
    expect(new URL(closed.url).searchParams.has('after')).toBe(false)
    closed.answer(page([]))
    await settle()
    expect(inbox.reports.value).toEqual([])
  })

  test('drops an answer for a filter that was left before it arrived', async () => {
    const inbox = useReportInbox()
    void inbox.refresh()
    const stale = await take('/admin/api/reports?')
    inbox.filter.value = 'all'
    await settle()
    const current = await take('/admin/api/reports?')
    current.answer(page([report(B, 'replied')]))
    await settle()
    stale.answer(page([report(A, 'open')]))
    await settle()
    expect(inbox.reports.value.map((each) => each.id)).toEqual([B])
  })

  test('shows the steps of the latest opening when the same report is reopened', async () => {
    const triage = useReportTriage({ update: async () => null, reports: shallowRef([]) })
    const opened = report(A, 'open')
    const older = triage.open(opened)
    const newer = triage.open(opened)
    const [olderRequest, newerRequest] = [
      await take(`/admin/api/reports/${A}`),
      await take(`/admin/api/reports/${A}`)
    ]
    newerRequest.answer(
      Response.json({
        ...opened,
        steps: [],
        stepsUnreadable: false,
        exceptions: [],
        issueURL: null
      })
    )
    await newer
    olderRequest.answer(new Response(null, { status: 502 }))
    await older

    expect(triage.detail.value?.id).toBe(A)
    expect(triage.detailFailed.value).toBe(false)
  })

  test('keeps a note being saved when a status is picked before it lands', async () => {
    const reports = shallowRef([report(A, 'open')])
    const sent: { status: string; note: string | null }[] = []
    const triage = useReportTriage({
      reports,
      update: async (reportId, change) => {
        sent.push(change)
        await new Promise((resolve) => {
          setTimeout(resolve, 5)
        })
        reports.value = reports.value.map((each) =>
          each.id === reportId ? { ...each, status: change.status, triageNote: change.note } : each
        )
        return reports.value.find((each) => each.id === reportId) ?? null
      }
    })
    const opened = report(A, 'open')
    const note = triage.setNote(opened, 'Asked for the file')
    const status = triage.setStatus(opened, 'replied')
    await Promise.all([note, status])

    expect(sent).toEqual([
      { status: 'open', note: 'Asked for the file' },
      { status: 'replied', note: 'Asked for the file' }
    ])
  })
})
