import { createSharedComposable, useNow } from '@vueuse/core'

import { useI18n } from '@open-pencil/vue/i18n'

/** How each kind of date in the interface reads, shown here in English. */
const DATE_FORMATS = {
  /** "Oct 19": an invitation's expiry, an older comment. */
  day: { month: 'short', day: 'numeric' },
  /** "Oct 19, 2026": when something was added or joined. */
  date: { dateStyle: 'medium' },
  /** "Oct 19, 2026, 4:05 PM": a saved copy or a file's last change. */
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  /** "4:05 PM": a version saved today. */
  time: { hour: 'numeric', minute: '2-digit' },
  /** "Oct 19, 4:05 PM": a version saved before today. */
  dayTime: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  /** "4:05:12 PM": an event in a log. */
  clock: { timeStyle: 'medium' }
} satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateFormat = keyof typeof DATE_FORMATS

type DateInput = Date | string | number | null | undefined

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const formats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(format: DateFormat, locale: string): Intl.DateTimeFormat {
  const key = `${locale}\u0000${format}`
  let found = formats.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(locale, DATE_FORMATS[format])
    formats.set(key, found)
  }
  return found
}

function timeOf(value: DateInput): number | null {
  if (value === null || value === undefined || value === '') return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/** A date in `format`, in the app's language `locale`; empty for a missing or invalid date. */
export function formatDate(value: DateInput, format: DateFormat, locale: string): string {
  const time = timeOf(value)
  return time === null ? '' : dateFormat(format, locale).format(time)
}

/** The time when it was today, else the day and time, as Figma titles autosaves. */
export function formatTimeOrDay(value: DateInput, now: number, locale: string): string {
  const time = timeOf(value)
  if (time === null) return ''
  const today = new Date(now).toDateString() === new Date(time).toDateString()
  return dateFormat(today ? 'time' : 'dayTime', locale).format(time)
}

/** "now", "5 min. ago", "3 hr. ago", "yesterday", then a short date; empty for a bad date. */
export function formatRelativeTime(value: DateInput, now: number, locale: string): string {
  const time = timeOf(value)
  if (time === null) return ''
  const elapsed = Math.max(0, now - time)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (elapsed < MINUTE) return relative.format(0, 'second')
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < WEEK) return relative.format(-Math.floor(elapsed / DAY), 'day')
  return dateFormat('day', locale).format(time)
}

/** One clock for every relative time, so "now" turns into "1 min. ago" on its own. */
const useSharedNow = createSharedComposable(() => useNow({ interval: 30_000 }))

/**
 * Dates as the interface shows them, in the language the app is set to. Read inside a computed or
 * the template, they follow a change of language, and relative times follow the clock.
 */
export function useDateFormat() {
  const { locale } = useI18n()
  const now = useSharedNow()
  return {
    format: (value: DateInput, format: DateFormat) => formatDate(value, format, locale.value),
    timeOrDay: (value: DateInput) => formatTimeOrDay(value, now.value.getTime(), locale.value),
    relative: (value: DateInput) => formatRelativeTime(value, now.value.getTime(), locale.value)
  }
}
