import * as v from 'valibot'

import { resolveDocumentShareSchema } from './sharing'

/** Why someone reports a document shared with them. */
export const documentReportReasonSchema = v.picklist([
  'spam-phishing',
  'illegal',
  'copyright',
  'harassment',
  'other'
])
export type DocumentReportReason = v.InferOutput<typeof documentReportReasonSchema>

/** How long a report's description may be. */
export const DOCUMENT_REPORT_DESCRIPTION_MAX = 2000

/**
 * A report about a document someone opened from a share link: the link's secret proves they can
 * see it, as resolving the link does, and a guest names themselves as they do there.
 */
export const fileDocumentReportSchema = v.object({
  secret: resolveDocumentShareSchema.entries.secret,
  guestId: resolveDocumentShareSchema.entries.guestId,
  reason: documentReportReasonSchema,
  description: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.maxLength(DOCUMENT_REPORT_DESCRIPTION_MAX)
  ),
  /** Where an administrator may answer; optional, and never shown to the document's people. */
  replyEmail: v.optional(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email(), v.maxLength(254)))
})
export type FileDocumentReportInput = v.InferOutput<typeof fileDocumentReportSchema>

export function parseFileDocumentReport(input: unknown): FileDocumentReportInput {
  return v.parse(fileDocumentReportSchema, input)
}

/** What filing a report answers: that it arrived, and nothing about the document. */
export const fileDocumentReportResponseSchema = v.object({ received: v.literal(true) })
