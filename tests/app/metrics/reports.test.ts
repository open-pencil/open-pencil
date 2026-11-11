import { describe, expect, test } from 'bun:test'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

import { reportInboxPage } from '@/app/metrics/reports'

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
