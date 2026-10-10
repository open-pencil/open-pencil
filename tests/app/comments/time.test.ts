import { expect, test } from 'bun:test'

import { formatCommentTime } from '@/app/comments/time'

const NOW = Date.parse('2026-10-09T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

test('recent comments read as relative times in the given locale', () => {
  expect(formatCommentTime(ago(10_000), NOW, 'en')).toBe('now')
  expect(formatCommentTime(ago(5 * 60_000), NOW, 'en')).toBe('5 min. ago')
  expect(formatCommentTime(ago(3 * 3_600_000), NOW, 'en')).toBe('3 hr. ago')
  expect(formatCommentTime(ago(24 * 3_600_000), NOW, 'en')).toBe('yesterday')
  expect(formatCommentTime(ago(5 * 60_000), NOW, 'de')).toBe('vor 5 Min.')
})

test('older comments show a short date and bad input shows nothing', () => {
  expect(formatCommentTime('2026-09-01T12:00:00.000Z', NOW, 'en')).toBe('Sep 1')
  expect(formatCommentTime('not a date', NOW, 'en')).toBe('')
})
