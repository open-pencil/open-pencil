import { type CalendarDate, parseAbsolute, today, toCalendarDate } from '@internationalized/date'

/** The dashboard counts in UTC days, as the feedback Worker records them. */
export const METRICS_TIME_ZONE = 'UTC'

export const utcToday = (): CalendarDate => today(METRICS_TIME_ZONE)

/** The UTC day of an ISO timestamp such as a sign-up's `2026-10-19T11:02:58.000Z`. */
export const utcDayOfTimestamp = (timestamp: string): CalendarDate =>
  toCalendarDate(parseAbsolute(timestamp, METRICS_TIME_ZONE))
