import { type CalendarDate, fromDate, parseAbsolute, toCalendarDate } from '@internationalized/date'

/**
 * Pings, snapshots, and the dashboard count in UTC calendar days. Days are `CalendarDate`s in
 * code and ISO dates (`2026-10-19`) only where they are stored or sent.
 */
const UTC = 'UTC'

/** The UTC day a moment falls on. */
export const utcDayOf = (moment: Date): CalendarDate => toCalendarDate(fromDate(moment, UTC))

/** The UTC day of an ISO timestamp such as GitHub's `2026-10-19T00:00:00Z`. */
export const utcDayOfTimestamp = (timestamp: string): CalendarDate =>
  toCalendarDate(parseAbsolute(timestamp, UTC))

/** Every day from `start` to `end`, both included, oldest first. */
export function eachDay(start: CalendarDate, end: CalendarDate): CalendarDate[] {
  const days: CalendarDate[] = []
  for (let day = start; day.compare(end) <= 0; day = day.add({ days: 1 })) days.push(day)
  return days
}
