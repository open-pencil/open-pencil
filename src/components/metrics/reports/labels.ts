import { compact } from 'es-toolkit'

import type { InboxReport, ReportStatus } from '@open-pencil/feedback/contract'

/** What a report's row menu can do. */
export type ReportAction = 'open' | 'reply' | 'replied' | 'closed' | 'open-again'

export const REPORT_STATUS_LABELS: Record<
  ReportStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' }
> = {
  open: { label: 'Open', tone: 'warning' },
  replied: { label: 'Replied', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' }
}

/** The sender's build in a few words, such as “0.16.0 · desktop · macos arm64”. */
export function reportBuild(report: InboxReport): string {
  const system = compact([report.platform, report.arch]).join(' ')
  const browser = report.browser === 'unknown' ? null : report.browser
  return compact([report.version, report.app, system, browser]).join(' · ')
}

/** A new email to the sender, its subject naming the report so the reply can be found again. */
export function replyLink(report: InboxReport): string {
  const subject = `Your OpenPencil report ${report.id.slice(0, 8)}`
  return `mailto:${report.email ?? ''}?subject=${encodeURIComponent(subject)}`
}
