import { describe, expect, test } from 'bun:test'

import { describeDiagnosticError } from '@/app/diagnostics'
import { storageOperationForJob } from '@/app/diagnostics/events'

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
    expect(storageOperationForJob('putThumb')).toBe('upload')
    expect(storageOperationForJob('deleteCanvas')).toBe('delete')
  })
})
