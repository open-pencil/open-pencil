import type { MetricsSnapshot } from '@open-pencil/feedback/contract'

/** The rows the dashboard's charts and lists take, named after the API's own shape. */
export type DailyActiveDay = MetricsSnapshot['dailyActive'][number]
export type DailyVisits = MetricsSnapshot['visits'][number]
export type DailyVersions = MetricsSnapshot['versions']['daily'][number]
export type DailyTraffic = MetricsSnapshot['github']['traffic'][number]
export type DailyIssues = MetricsSnapshot['github']['activity']['issues'][number]
export type DailyPulls = MetricsSnapshot['github']['activity']['pulls'][number]
export type PlatformCount = MetricsSnapshot['platforms'][number]
export type Release = MetricsSnapshot['releases'][number]
export type WaitlistSignup = MetricsSnapshot['waitlist']['recent'][number]
