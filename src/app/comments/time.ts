import { createSharedComposable, useNow } from '@vueuse/core'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** One clock for every comment timestamp, so "now" turns into "1 min. ago" on its own. */
export const useCommentClock = createSharedComposable(() => useNow({ interval: 30_000 }))

/** "now", "5 min. ago", "3 hr. ago", "yesterday", then a short date, in the app's locale. */
export function formatCommentTime(iso: string, now: number, locale: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const elapsed = Math.max(0, now - then)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (elapsed < MINUTE) return relative.format(0, 'second')
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < WEEK) return relative.format(-Math.floor(elapsed / DAY), 'day')
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(then)
}
