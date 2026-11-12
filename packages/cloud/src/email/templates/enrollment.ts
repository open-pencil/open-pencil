import type { DocumentReportReason } from '#cloud/contract'

import type {
  AdminEnrollmentNotificationPayload,
  DocumentReportPayload,
  EnrollmentEmailPayload
} from '../schema'
import { greeting, type EmailTemplate } from './content'

export const enrollmentRequested: EmailTemplate<EnrollmentEmailPayload> = (payload, { t }) => ({
  subject: t.enrollmentRequestedSubject,
  preview: t.enrollmentRequestedPreview,
  heading: t.enrollmentRequestedHeading,
  paragraphs: [greeting(t, payload.name), t.enrollmentRequested],
  action: { label: t.openCloud, url: payload.actionURL }
})

export const enrollmentApproved: EmailTemplate<EnrollmentEmailPayload> = (payload, { t }) => ({
  subject: t.enrollmentApprovedSubject,
  preview: t.enrollmentApprovedPreview,
  heading: t.enrollmentApprovedHeading,
  paragraphs: [greeting(t, payload.name), t.enrollmentApproved],
  action: { label: t.enrollmentApprovedAction, url: payload.actionURL }
})

export const enrollmentRejected: EmailTemplate<EnrollmentEmailPayload> = (payload, { t }) => ({
  subject: t.enrollmentRejectedSubject,
  preview: t.enrollmentRejectedPreview,
  heading: t.enrollmentRejectedHeading,
  paragraphs: [greeting(t, payload.name), t.enrollmentRejected],
  action: { label: t.enrollmentRejectedAction, url: payload.actionURL }
})

export const enrollmentRevoked: EmailTemplate<EnrollmentEmailPayload> = (payload, { t }) => ({
  subject: t.enrollmentRevokedSubject,
  preview: t.enrollmentRevokedPreview,
  heading: t.enrollmentRevokedHeading,
  paragraphs: [greeting(t, payload.name), t.enrollmentRevoked],
  action: { label: t.enrollmentRevokedAction, url: payload.actionURL }
})

/** To administrators: someone asked for access, in their own words. */
export const enrollmentNotification: EmailTemplate<AdminEnrollmentNotificationPayload> = (
  payload,
  { t }
) => ({
  subject: t.enrollmentNotificationSubject,
  preview: t.enrollmentNotificationPreview({ email: payload.requesterEmail }),
  heading: t.enrollmentNotificationHeading,
  paragraphs: [
    t.enrollmentNotification({ name: payload.requesterName, email: payload.requesterEmail }),
    payload.reason
  ],
  action: { label: t.enrollmentNotificationAction, url: payload.actionURL }
})

/** To administrators: someone reported a shared document, in their own words. */
export const documentReport: EmailTemplate<DocumentReportPayload> = (payload, { t }) => {
  const reasons: Record<DocumentReportReason, string> = {
    'spam-phishing': t.reportReasonSpamPhishing,
    illegal: t.reportReasonIllegal,
    copyright: t.reportReasonCopyright,
    harassment: t.reportReasonHarassment,
    other: t.reportReasonOther
  }
  const report = { document: payload.documentName, reason: reasons[payload.reason] }
  return {
    subject: t.documentReportSubject,
    preview: t.documentReportPreview(report),
    heading: t.documentReportHeading,
    paragraphs: [t.documentReport(report), payload.description],
    action: { label: t.documentReportAction, url: payload.actionURL }
  }
}
