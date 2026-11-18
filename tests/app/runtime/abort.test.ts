import { describe, expect, test } from 'bun:test'

import { withAbortSignal } from '@/app/runtime/abort'

describe('withAbortSignal', () => {
  test('resolves with the wrapped promise', async () => {
    const controller = new AbortController()

    await expect(withAbortSignal(Promise.resolve('ok'), controller.signal)).resolves.toBe('ok')
  })

  test('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled')
    controller.abort(reason)

    const pending = Promise.withResolvers<string>()
    const result = withAbortSignal(pending.promise, controller.signal)

    await expect(result).rejects.toBe(reason)
    pending.reject(new Error('late request failure'))
    await Promise.resolve()
  })

  test('rejects a pending promise when the signal aborts', async () => {
    const controller = new AbortController()
    const pending = Promise.withResolvers<string>()
    const result = withAbortSignal(pending.promise, controller.signal)
    const reason = new Error('cancelled')

    controller.abort(reason)

    await expect(result).rejects.toBe(reason)
    pending.resolve('late result')
  })
})
