import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'bun:test'

import { diagnostics } from '@/app/diagnostics'
import { recordRuntimeError } from '@/app/diagnostics/events/runtime'

beforeEach(async () => {
  await diagnostics.clear()
})

test('records an uncaught error with its details', async () => {
  const error = new TypeError('Attempting to define property on object that is not extensible.')
  recordRuntimeError(error, 'vue', 'render function')

  const [event] = await diagnostics.list()
  expect(event).toMatchObject({
    category: 'runtime',
    level: 'error',
    name: 'runtime.error',
    attributes: {
      source: 'vue',
      errorName: 'TypeError',
      message: 'Attempting to define property on object that is not extensible.',
      info: 'render function'
    }
  })
  expect(event.attributes.stack).toContain('TypeError')
})

test('records one of a burst of identical errors, and each distinct one', async () => {
  const error = new Error('loop')
  for (let i = 0; i < 5; i++) recordRuntimeError(error, 'window')
  recordRuntimeError(new Error('other'), 'window')

  // Both can share a millisecond, so their stored order is not fixed.
  const messages = (await diagnostics.list()).map((event) => String(event.attributes.message))
  expect(messages.toSorted()).toEqual(['loop', 'other'])
})

test('records an alternating pair of repeating errors once each', async () => {
  const first = new Error('first')
  const second = new Error('second')
  for (let i = 0; i < 4; i++) {
    recordRuntimeError(first, 'window')
    recordRuntimeError(second, 'window')
  }

  const messages = (await diagnostics.list()).map((event) => String(event.attributes.message))
  expect(messages.toSorted()).toEqual(['first', 'second'])
})
