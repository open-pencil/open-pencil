import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'bun:test'

import { diagnostics } from '@/app/diagnostics'
import { recordToolCompleted } from '@/app/diagnostics/events/ai'

const run = { tool: 'render', durationMs: 12, mutates: true }

beforeEach(async () => {
  await diagnostics.clear()
})

test('a tool that broke inside the engine is an error with its message and stack', async () => {
  recordToolCompleted({ ...run, failed: true }, {}, new TypeError('stops.map is not a function'))

  const [event] = await diagnostics.list()
  expect(event.level).toBe('error')
  expect(event.attributes).toMatchObject({
    errorName: 'TypeError',
    message: 'stops.map is not a function'
  })
  expect(String(event.attributes.stack)).toContain('TypeError')
})

test('a tool the model called wrongly is a warning without the message', async () => {
  recordToolCompleted({ ...run, failed: true }, {}, new Error('Node "Pricing card" not found'))

  const [event] = await diagnostics.list()
  expect(event.level).toBe('warning')
  expect(event.attributes.errorName).toBe('Error')
  expect(event.attributes.message).toBeUndefined()
  expect(event.attributes.stack).toBeUndefined()
})

test('a tool that succeeded is info', async () => {
  recordToolCompleted({ ...run, failed: false })

  const [event] = await diagnostics.list()
  expect(event.level).toBe('info')
  expect(event.attributes.errorName).toBeUndefined()
})
