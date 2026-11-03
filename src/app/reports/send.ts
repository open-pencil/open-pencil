import * as v from 'valibot'

import type { FeedbackClient } from '@open-pencil/feedback/client'
import {
  reportReceiptSchema,
  type Report,
  type ReportReceipt
} from '@open-pencil/feedback/contract'

import { feedback } from '@/app/feedback/client'

import type { ReportAttachment } from './build'

export type ReportSendResult =
  | { ok: true; reportId: string }
  | { ok: false; failure: 'report' }
  /** The report went through; sending again with its receipt uploads only the files. */
  | { ok: false; failure: 'files'; receipt: ReportReceipt }

/** Which step failed: the report itself, or an attached file after the report went through. */
export type ReportSendFailure = Extract<ReportSendResult, { ok: false }>['failure']

export interface ReportSendOptions {
  client?: FeedbackClient
  /** The receipt of this report from an earlier send whose files failed, so it is not sent twice. */
  delivered?: ReportReceipt | null
}

async function deliver(report: Report, client: FeedbackClient): Promise<ReportReceipt | null> {
  const response = await client.reports.$post({ json: report }).catch(() => null)
  if (response?.status !== 201) return null
  const receipt = v.safeParse(reportReceiptSchema, await response.json().catch(() => null))
  return receipt.success ? receipt.output : null
}

/**
 * Sends a report to the feedback service, then each attached file with the token its answer
 * carries. A failed upload still leaves the report delivered, under its receipt.
 */
export async function sendReport(
  report: Report,
  attachments: ReportAttachment[],
  { client = feedback, delivered = null }: ReportSendOptions = {}
): Promise<ReportSendResult> {
  const receipt = delivered ?? (await deliver(report, client))
  if (!receipt) return { ok: false, failure: 'report' }
  const { reportId, uploadToken } = receipt
  if (attachments.length === 0) return { ok: true, reportId }
  if (!uploadToken) return { ok: false, failure: 'files', receipt }

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
    if (uploaded?.status !== 204) return { ok: false, failure: 'files', receipt }
  }
  return { ok: true, reportId }
}
