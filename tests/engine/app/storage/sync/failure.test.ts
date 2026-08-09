import { describe, expect, test } from 'bun:test'

import {
  categorizeSyncFailure,
  clearSyncFailure,
  formatSyncFailureReport,
  isFetchLevelFailure,
  lastSyncFailure,
  recordSyncFailure,
  type SyncFailure
} from '@/app/storage/sync/failure'

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message = `HTTP ${status}`) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function failure(overrides: Partial<SyncFailure> = {}): SyncFailure {
  return {
    operation: 'putCanvas',
    providerId: 's3-compatible',
    providerContext: { Endpoint: 'https://example.test', Bucket: 'designs' },
    documentIds: ['doc-1'],
    documentName: 'Quarterly deck',
    occurredAt: '2026-08-03T12:00:00.000Z',
    attempts: 2,
    category: 'server',
    rawError: 'HTTP 503',
    status: 503,
    ...overrides
  }
}

describe('categorizeSyncFailure', () => {
  test('maps provider status codes to distinct remedies', () => {
    expect(categorizeSyncFailure(new HttpError(401))).toBe('credentials')
    expect(categorizeSyncFailure(new HttpError(403))).toBe('permission')
    expect(categorizeSyncFailure(new HttpError(404))).toBe('not-found')
    expect(categorizeSyncFailure(new HttpError(503))).toBe('server')
  })

  test('separates CORS from offline, which look identical to the browser', () => {
    // Both surface as `TypeError: Failed to fetch`. A cross-origin rejection and
    // a dead network are indistinguishable from the error alone, and the fixes
    // share nothing — one is a bucket policy, the other is connectivity.
    const fetchFailure = new TypeError('Failed to fetch')

    expect(isFetchLevelFailure(fetchFailure)).toBe(true)
    expect(categorizeSyncFailure(fetchFailure, true)).toBe('cors')
    expect(categorizeSyncFailure(fetchFailure, false)).toBe('offline')
  })

  test('does not read a status out of message text', () => {
    // The old check substring-matched '403', so a byte count or a request id
    // containing those digits permanently parked a document mutation.
    const misleading = new Error('uploaded 403 bytes to request 401abc')

    expect(categorizeSyncFailure(misleading)).toBe('unknown')
  })

  test('falls back to provider wording when no status is supplied', () => {
    expect(categorizeSyncFailure(new Error('Access Denied'))).toBe('permission')
    expect(categorizeSyncFailure(new Error('Invalid access key id'))).toBe('credentials')
  })

  test('handles a thrown non-Error', () => {
    expect(categorizeSyncFailure('something went wrong')).toBe('unknown')
  })
})

describe('failure snapshots', () => {
  test('retain the context captured at failure time', () => {
    // The point of snapshotting: switching providers afterwards used to
    // re-label a stored failure with the wrong endpoint.
    recordSyncFailure(failure())
    const captured = lastSyncFailure.value

    expect(captured?.providerContext).toEqual({
      Endpoint: 'https://example.test',
      Bucket: 'designs'
    })
    expect(captured?.documentName).toBe('Quarterly deck')
    expect(captured?.attempts).toBe(2)
    // Verbatim provider text survives — guidance accompanies it, never replaces it.
    expect(captured?.rawError).toBe('HTTP 503')
  })

  test('clear on recovery so a stale failure cannot be reopened', () => {
    recordSyncFailure(failure())
    expect(lastSyncFailure.value).not.toBeNull()

    clearSyncFailure()

    expect(lastSyncFailure.value).toBeNull()
  })
})

describe('formatSyncFailureReport', () => {
  test('carries the snapshot a bug report needs, verbatim error last', () => {
    const report = formatSyncFailureReport(
      failure({
        category: 'permission',
        status: 403,
        rawError: 'User (role: guests) missing scopes (["buckets.read"])'
      })
    )

    expect(report).toContain('Operation: putCanvas')
    expect(report).toContain('Endpoint: https://example.test')
    expect(report).toContain('Bucket: designs')
    expect(report).toContain('Quarterly deck')
    expect(report).toContain('doc-1')
    expect(report).toContain('Attempts: 2')
    expect(report).toContain('Time: 2026-08-03T12:00:00.000Z')
    // The provider's own words are the payload, not a paraphrase of them.
    expect(report.endsWith('User (role: guests) missing scopes (["buckets.read"])')).toBe(true)
  })

  test('reports a missing HTTP status rather than dropping the line', () => {
    expect(formatSyncFailureReport(failure({ status: null }))).toContain('HTTP status: n/a')
  })
})
