import { describe, expect, test } from 'bun:test'

import { describeDiagnosticError } from '@/app/diagnostics'
import { storageOperationForJob } from '@/app/diagnostics/events'
import {
  preparationDurationBucket,
  recordPreparationOutcome
} from '@/app/diagnostics/events/preparation'

test('preparation diagnostics bucket durations without sensitive subjects', () => {
  expect(
    [99, 100, 999, 1_000, 4_999, 5_000, 29_999, 30_000].map(preparationDurationBucket)
  ).toEqual([
    'under-100ms',
    '100ms-1s',
    '100ms-1s',
    '1s-5s',
    '1s-5s',
    '5s-30s',
    '5s-30s',
    'over-30s'
  ])
  recordPreparationOutcome({
    kind: 'document-open',
    outcome: 'failed',
    cancellationReason: null,
    failureCode: 'decode-failed',
    terminalPhase: 'decoding',
    durationMs: 1_234
  })
})

describe('diagnostic error metadata', () => {
  test('keeps only safe error metadata', () => {
    const error = Object.assign(new Error('secret message'), { code: 'E_NETWORK', status: 500 })
    expect(describeDiagnosticError(error)).toEqual({
      errorName: 'Error',
      errorCode: 'E_NETWORK',
      retryable: true
    })
  })

  test('classifies aborts as non-retryable', () => {
    expect(describeDiagnosticError(new DOMException('cancelled', 'AbortError')).retryable).toBe(
      false
    )
  })

  test('handles unknown thrown values', () => {
    expect(describeDiagnosticError('failure')).toEqual({
      errorName: 'UnknownError',
      errorCode: null,
      retryable: null
    })
  })
})

describe('storageOperationForJob', () => {
  test('maps every outbox operation explicitly', () => {
    expect(storageOperationForJob('putCanvas')).toBe('upload')
    expect(storageOperationForJob('deleteCanvas')).toBe('delete')
  })
})
