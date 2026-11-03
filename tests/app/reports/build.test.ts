import { afterEach, expect, test } from 'bun:test'

import { REPORT_BODY_MAX_BYTES, type Build } from '@open-pencil/feedback/contract'

import type { DiagnosticEvent } from '@/app/diagnostics'
import { buildReport, type ReportDraft } from '@/app/reports/build'
import { reportExceptions } from '@/app/reports/exception'

const BUILD: Build = {
  version: '0.17.0',
  platform: 'macos',
  arch: 'arm64',
  app: 'desktop',
  browser: 'unknown'
}
const RELEASE = '01a19e69-fdef-0000-e554-4733f3a5a77c'

const draft = (overrides: Partial<ReportDraft> = {}): ReportDraft => ({
  exceptions: null,
  note: '',
  email: '',
  activity: null,
  attachments: [],
  ...overrides
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, '_posthogReleaseId')
})

test('a problem needs a description', () => {
  expect(buildReport(draft({ note: '   ' }), { build: BUILD, installId: null })).toBeNull()
  expect(
    buildReport(draft({ note: 'Text jumps on resize' }), { build: BUILD, installId: null })
  ).toMatchObject({ kind: 'problem', note: 'Text jumps on resize', ...BUILD })
})

test('an error carries the release its chunks were built in', () => {
  Reflect.set(globalThis, '_posthogReleaseId', RELEASE)
  const exceptions = reportExceptions(new TypeError('failed'), 'window')

  expect(buildReport(draft({ exceptions }), { build: BUILD, installId: null })).toMatchObject({
    kind: 'error',
    release: RELEASE,
    exceptions
  })
})

test('the install ID goes along only when the context has one', () => {
  const installId = '0123456789abcdef0123456789abcdef'
  const report = buildReport(draft({ note: 'Broken' }), { build: BUILD, installId })
  expect(report?.installId).toBe(installId)
  expect(
    buildReport(draft({ note: 'Broken' }), { build: BUILD, installId: null })?.installId
  ).toBeUndefined()
})

test('attachments are declared by name and size', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const report = buildReport(
    draft({ note: 'Broken', attachments: [{ name: 'document.fig', bytes }] }),
    { build: BUILD, installId: null }
  )
  expect(report?.files).toEqual([{ name: 'document.fig', size: 3 }])
})

test('an invalid email keeps the report from being sent', () => {
  expect(
    buildReport(draft({ note: 'Broken', email: 'not an address' }), {
      build: BUILD,
      installId: null
    })
  ).toBeNull()
})

test('the oldest steps are left out to keep the body within the service’s limit', () => {
  const attributes = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => [`field${index}`, 'x'.repeat(4000)])
  )
  const activity = Array.from({ length: 50 }, (_, index): DiagnosticEvent => ({
    id: `event-${index}`,
    timestamp: Date.UTC(2026, 10, 3, 9, 0, 50 - index),
    category: 'document',
    level: 'info',
    name: 'document.saved',
    attributes
  }))
  const report = buildReport(draft({ note: 'Broken', activity }), { build: BUILD, installId: null })
  const steps = report?.steps ?? []

  expect(new TextEncoder().encode(JSON.stringify(report)).byteLength).toBeLessThanOrEqual(
    REPORT_BODY_MAX_BYTES
  )
  expect(steps.length).toBeGreaterThan(0)
  expect(steps.length).toBeLessThan(50)
  expect(steps.at(-1)?.timestamp).toBe(new Date(Date.UTC(2026, 10, 3, 9, 0, 50)).toISOString())
})
