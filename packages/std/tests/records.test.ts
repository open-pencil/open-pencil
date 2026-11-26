import { expect, test } from 'bun:test'

import { isRecord } from '@open-pencil/std/records'

test('isRecord accepts objects, not null, arrays, or primitives', () => {
  expect(isRecord({})).toBe(true)
  expect(isRecord(Object.create(null))).toBe(true)
  expect(isRecord(null)).toBe(false)
  expect(isRecord([])).toBe(false)
  expect(isRecord('text')).toBe(false)
  expect(isRecord(1)).toBe(false)
})
