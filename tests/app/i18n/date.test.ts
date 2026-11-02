import { describe, expect, test } from 'bun:test'

import { formatDate, formatRelativeTime, formatTimeOrDay } from '@/app/i18n/date'

// Dates are built at local noon, so the calendar day is the same in every time zone.
const NOW = new Date(2026, 9, 9, 12).getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('relative times', () => {
  test('read as how long ago, in the given language', () => {
    expect(formatRelativeTime(ago(10_000), NOW, 'en')).toBe('now')
    expect(formatRelativeTime(ago(5 * 60_000), NOW, 'en')).toBe('5 min. ago')
    expect(formatRelativeTime(ago(3 * 3_600_000), NOW, 'en')).toBe('3 hr. ago')
    expect(formatRelativeTime(ago(24 * 3_600_000), NOW, 'en')).toBe('yesterday')
    expect(formatRelativeTime(ago(5 * 60_000), NOW, 'de')).toBe('vor 5 Min.')
  })

  test('turn into a short date after a week, and show nothing for a bad date', () => {
    expect(formatRelativeTime(new Date(2026, 8, 1, 12), NOW, 'en')).toBe('Sep 1')
    expect(formatRelativeTime('not a date', NOW, 'en')).toBe('')
  })
})

describe('dates', () => {
  test('follow the language they are given, not the browser’s', () => {
    const day = new Date(2026, 9, 19, 12)
    expect(formatDate(day, 'date', 'en')).toBe('Oct 19, 2026')
    expect(formatDate(day, 'date', 'de')).toBe('19.10.2026')
  })

  test('show nothing for a missing or bad date', () => {
    expect(formatDate(null, 'dateTime', 'en')).toBe('')
    expect(formatDate('', 'day', 'en')).toBe('')
    expect(formatDate('not a date', 'day', 'en')).toBe('')
  })

  test('give the time for today and the day as well before, as autosaves read', () => {
    // ICU puts a narrow no-break space before AM and PM; the words are what the test is about.
    const read = (text: string) => text.replaceAll('\u202f', ' ')
    expect(read(formatTimeOrDay(new Date(2026, 9, 9, 11), NOW, 'en'))).toBe('11:00 AM')
    // How the day joins the time ("," or "at") changes between CLDR versions; both parts must show.
    const earlier = read(formatTimeOrDay(new Date(2026, 9, 6, 15, 30), NOW, 'en'))
    expect(earlier).toStartWith('Oct 6')
    expect(earlier).toEndWith('3:30 PM')
  })
})
