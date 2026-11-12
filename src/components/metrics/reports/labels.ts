import { compact } from 'es-toolkit'

import type {
  InboxException,
  InboxFrame,
  InboxReport,
  ReportStatus
} from '@open-pencil/feedback/contract'

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

/** The sender's app, as people call it: “Desktop app”. */
export const reportApp = (report: InboxReport) => named(APP_NAMES, report.app)
/** The sender's system and architecture: “macOS arm64”. */
export const reportSystem = (report: InboxReport) =>
  compact([named(PLATFORM_NAMES, report.platform), report.arch]).join(' ') || null
/** The sender's browser, for the web app: “Chrome”. */
export const reportBrowser = (report: InboxReport) =>
  report.browser === 'unknown' ? null : named(BROWSER_NAMES, report.browser)

/** The sender's build in a few words, such as “0.16.0 · Desktop app · macOS arm64”. */
export function reportBuild(report: InboxReport): string {
  return compact([
    report.version,
    reportApp(report),
    reportSystem(report),
    reportBrowser(report)
  ]).join(' · ')
}

/** A new email to the sender, its subject naming the report so the reply can be found again. */
export function replyLink(report: InboxReport): string {
  const subject = `Your OpenPencil report ${report.id.slice(0, 8)}`
  return `mailto:${report.email ?? ''}?subject=${encodeURIComponent(subject)}`
}

/**
 * How long before the report a step happened, as `−1m 46s`; a step without a time, or after the
 * report, says so plainly.
 */
export function beforeReport(timestamp: string | null, receivedAt: string): string {
  if (!timestamp) return '—'
  const seconds = Math.round((Date.parse(receivedAt) - Date.parse(timestamp)) / 1000)
  if (!Number.isFinite(seconds)) return '—'
  if (seconds <= 0) return 'at report'
  const minutes = Math.floor(seconds / 60)
  return minutes ? `−${minutes}m ${seconds % 60}s` : `−${seconds}s`
}

/** Where a frame points, split so its file name can stand out of the folders before it. */
export function frameLocation(frame: InboxFrame): {
  folder: string
  file: string
  position: string
} {
  const path = (frame.file ?? '')
    .replace(/^(?:webpack|vite):\/\/\/?/, '')
    .replace(/^https?:\/\/[^/]+\//, '')
  const slash = path.lastIndexOf('/') + 1
  return {
    folder: path.slice(0, slash),
    file: path.slice(slash),
    position: compact([frame.line, frame.column])
      .map((part) => `:${part}`)
      .join('')
  }
}

/** An exception as a JavaScript engine prints it, for pasting into an issue or a search. */
export function exceptionText(exception: InboxException): string {
  const frames = exception.frames.map((frame) => {
    const { folder, file, position } = frameLocation(frame)
    const where = `${folder}${file}${position}`
    return `    at ${compact([frame.function, where && `(${where})`]).join(' ') || '<unknown>'}`
  })
  return [compact([exception.type, exception.message]).join(': '), ...frames].join('\n')
}

/** A step's level as a glyph: errors and warnings stand out, the rest stay quiet. */
export function stepLevel(level: string | null): string {
  if (level === 'error') return '●'
  return level === 'warning' ? '▲' : '·'
}
