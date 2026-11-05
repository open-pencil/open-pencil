import { REPORT_STEPS_LIMIT, type ReportStep } from '@open-pencil/feedback/contract'

import type { DiagnosticEvent } from '@/app/diagnostics'

const MAX_ATTRIBUTES = 24
const MAX_TEXT_LENGTH = 4000
const STEP_NAME = /^[a-z][a-z0-9_.]{0,63}$/
const ATTRIBUTE_KEY = /^[A-Za-z][\w.]{0,63}$/

function toStep(event: DiagnosticEvent): ReportStep | null {
  if (!STEP_NAME.test(event.name) || !/^[a-z]{1,32}$/.test(event.category)) return null
  return {
    name: event.name,
    category: event.category,
    level: event.level,
    timestamp: new Date(event.timestamp).toISOString(),
    attributes: Object.fromEntries(
      Object.entries(event.attributes)
        .filter(([key]) => ATTRIBUTE_KEY.test(key))
        .slice(0, MAX_ATTRIBUTES)
        .map(([key, value]) => [
          key,
          typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : value
        ])
    )
  }
}

/**
 * The most recent diagnostics events, oldest first, as a report's steps. The log scrubbed them
 * when it recorded them and never holds chat messages or tool payloads.
 */
export function reportSteps(recentFirst: DiagnosticEvent[]): ReportStep[] {
  return recentFirst
    .slice(0, REPORT_STEPS_LIMIT)
    .flatMap((event) => toStep(event) ?? [])
    .reverse()
}
