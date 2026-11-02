import * as v from 'valibot'

import type { FeedbackClient } from '@open-pencil/feedback/client'
import { reportReceiptSchema, type Report } from '@open-pencil/feedback/contract'

import { feedback } from '@/app/feedback/client'

import type { ReportAttachment } from './build'

/** Which step failed: the report itself, or an attached file after the report went through. */
export type ReportSendFailure = 'report' | 'files'

export type ReportSendResult =
  | { ok: true; reportId: string }
  | { ok: false; failure: ReportSendFailure; reportId: string | null }

/**
 * Sends a report to the feedback service, then each attached file with the token its answer
 * carries. A failed upload still leaves the report delivered, under its ID.
 */
export async function sendReport(
  report: Report,
  attachments: ReportAttachment[],
  client: FeedbackClient = feedback
): Promise<ReportSendResult> {
  const response = await client.reports.$post({ json: report }).catch(() => null)
  if (response?.status !== 201) return { ok: false, failure: 'report', reportId: null }
  const receipt = v.safeParse(reportReceiptSchema, await response.json().catch(() => null))
  if (!receipt.success) return { ok: false, failure: 'report', reportId: null }
  const { reportId, uploadToken } = receipt.output
  if (attachments.length === 0) return { ok: true, reportId }
  if (!uploadToken) return { ok: false, failure: 'files', reportId }

  for (const file of attachments) {
    const uploaded = await client.reports[':reportId'].files[':name']
      .$put(
        { param: { reportId, name: file.name } },
        {
          headers: {
            Authorization: `Bearer ${uploadToken}`,
            'Content-Type': 'application/octet-stream'
          },
          // A copy backed by a plain ArrayBuffer, which `fetch` takes as a body.
          init: { body: file.bytes.slice() }
        }
      )
      .catch(() => null)
    if (uploaded?.status !== 204) return { ok: false, failure: 'files', reportId }
  }
  return { ok: true, reportId }
}
