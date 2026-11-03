import { getInjectedReleaseId } from '@posthog/core/error-tracking'
import * as v from 'valibot'

import {
  REPORT_BODY_MAX_BYTES,
  reportSchema,
  type Build,
  type Report,
  type ReportException,
  type ReportFileName
} from '@open-pencil/feedback/contract'

import type { DiagnosticEvent } from '@/app/diagnostics'

import { reportSteps } from './steps'

/** A file attached to a report, under a fixed name the service accepts. */
export interface ReportAttachment {
  name: ReportFileName
  bytes: Uint8Array
}

/** What the person filled in, and what the app knows about the error, before it becomes a report. */
export interface ReportDraft {
  /** The caught error, or none for a problem the person describes. */
  exceptions: ReportException[] | null
  note: string
  email: string
  /** Recent diagnostics events, recent first, when the person agreed to include them. */
  activity: DiagnosticEvent[] | null
  attachments: ReportAttachment[]
}

/** What else goes into every report: the build, and the install ID only while usage stats are shared. */
export interface ReportContext {
  build: Build
  installId: string | null
}

function optionalText(text: string): string | undefined {
  const trimmed = text.trim()
  return trimmed ? trimmed : undefined
}

const encoder = new TextEncoder()

function bodyBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength
}

/**
 * The report within the body limit: its most recent steps that fit, or `null` when even without
 * steps it is too large.
 */
function withinBodyLimit(report: Report): Report | null {
  if (bodyBytes(report) <= REPORT_BODY_MAX_BYTES) return report
  const steps = report.steps ?? []
  // Counts an empty list, which is longer than none, and a comma before each step.
  let budget = REPORT_BODY_MAX_BYTES - bodyBytes({ ...report, steps: [] })
  let kept = 0
  for (const step of steps.toReversed()) {
    const size = bodyBytes(step) + 1
    if (size > budget) break
    budget -= size
    kept++
  }
  if (kept > 0) return { ...report, steps: steps.slice(-kept) }
  const withoutSteps = { ...report, steps: undefined }
  return bodyBytes(withoutSteps) <= REPORT_BODY_MAX_BYTES ? withoutSteps : null
}

/**
 * The report exactly as it will be sent, which the dialog shows before sending, or `null` while
 * the draft is not one the service would accept, such as a problem without a description. Steps
 * that would push the body past the service's limit are left out, oldest first.
 */
export function buildReport(draft: ReportDraft, context: ReportContext): Report | null {
  const steps = draft.activity ? reportSteps(draft.activity) : undefined
  const fields = {
    ...context.build,
    installId: context.installId ?? undefined,
    release: draft.exceptions ? getInjectedReleaseId() : undefined,
    note: optionalText(draft.note),
    email: optionalText(draft.email),
    steps: steps?.length ? steps : undefined,
    files: draft.attachments.length
      ? draft.attachments.map((file) => ({ name: file.name, size: file.bytes.byteLength }))
      : undefined
  }
  const report = draft.exceptions
    ? { kind: 'error', exceptions: draft.exceptions, ...fields }
    : { kind: 'problem', ...fields }
  const parsed = v.safeParse(reportSchema, report)
  return parsed.success ? withinBodyLimit(parsed.output) : null
}
