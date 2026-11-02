import { getInjectedReleaseId } from '@posthog/core/error-tracking'
import * as v from 'valibot'

import {
  reportSchema,
  type Build,
  type Report,
  type ReportException
} from '@open-pencil/feedback/contract'

import type { DiagnosticEvent } from '@/app/diagnostics'

import { reportSteps } from './steps'

/** A file attached to a report, under the fixed name the service accepts. */
export interface ReportAttachment {
  name: 'document.fig'
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

/**
 * The report exactly as it will be sent, which the dialog shows before sending, or `null` while
 * the draft is not one the service would accept, such as a problem without a description.
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
  return parsed.success ? parsed.output : null
}
