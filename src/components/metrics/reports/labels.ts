import { compact } from 'es-toolkit'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

export const REPORT_STATUS_LABELS: Record<
  ReportStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' }
> = {
  open: { label: 'Open', tone: 'warning' },
  replied: { label: 'Replied', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' }
}

const PLATFORM_NAMES: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android'
}
const APP_NAMES: Record<string, string> = { desktop: 'Desktop app', web: 'Web app' }
const BROWSER_NAMES: Record<string, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  opera: 'Opera'
}
/** A recorded name as people read it; one the dashboard doesn't know shows as recorded. */
const named = (names: Record<string, string>, value: string | null) =>
  value === null ? null : (names[value] ?? value)

/** The sender's build in a few words, such as “0.16.0 · Desktop app · macOS arm64”. */
export function reportBuild(report: InboxReport): string {
  const system = compact([named(PLATFORM_NAMES, report.platform), report.arch]).join(' ')
  const browser = report.browser === 'unknown' ? null : named(BROWSER_NAMES, report.browser)
  return compact([report.version, named(APP_NAMES, report.app), system, browser]).join(' · ')
}

/** A new email to the sender, its subject naming the report so the reply can be found again. */
export function replyLink(report: InboxReport): string {
  const subject = `Your OpenPencil report ${report.id.slice(0, 8)}`
  return `mailto:${report.email ?? ''}?subject=${encodeURIComponent(subject)}`
}

/** A step's time of day in UTC, to the second, as the dashboard counts days: `09:41:58`. */
export function stepTime(timestamp: string | null): string {
  return timestamp ? new Date(timestamp).toISOString().slice(11, 19) : '—'
}

/** A step's level as a glyph: errors and warnings stand out, the rest stay quiet. */
export function stepLevel(level: string | null): string {
  if (level === 'error') return '●'
  return level === 'warning' ? '▲' : '·'
}
