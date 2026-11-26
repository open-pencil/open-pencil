import { describe, expect, test } from 'bun:test'

import { errorMessage, isAbortError, toError } from '@open-pencil/std/errors'

describe('errors', () => {
  test('errorMessage reads an Error’s message and turns anything else into text', () => {
    expect(errorMessage(new TypeError('bad'))).toBe('bad')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
    expect(errorMessage(undefined)).toBe('undefined')
  })

  test('toError keeps an Error and wraps anything else', () => {
    const error = new RangeError('out')
    expect(toError(error)).toBe(error)
    const wrapped = toError('text')
    expect(wrapped).toBeInstanceOf(Error)
    expect(wrapped.message).toBe('text')
  })

  test('isAbortError recognises aborts and cancelled pickers', () => {
    const controller = new AbortController()
    controller.abort()
    expect(isAbortError(controller.signal.reason)).toBe(true)
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true)
    expect(isAbortError(new DOMException('late', 'TimeoutError'))).toBe(false)
    expect(isAbortError(new Error('other'))).toBe(false)
    expect(isAbortError({ name: 'AbortError' })).toBe(false)
  })
})
