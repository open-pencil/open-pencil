import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Transaction } from 'kysely'

import type { EnrollmentStatus } from './service'

export type EnrollmentEmailOptions = {
  appURL: string
  adminRecipients: string[]
  email?: TransactionalEmailService
}

export async function enqueueEnrollmentRequested(
  transaction: Transaction<CloudDatabase>,
  options: EnrollmentEmailOptions,
  input: { enrollmentId: string; email: string; name: string; reason: string; revision: number }
): Promise<void> {
  if (!options.email) return
  await options.email.enqueue(
    {
      idempotencyKey: `enrollment-requested/${input.enrollmentId}/${input.revision}`,
      kind: 'enrollment-requested',
      recipientEmail: input.email,
      payload: { name: input.name, actionURL: `${options.appURL}/sign-in` }
    },
    transaction
  )
  for (const recipientEmail of options.adminRecipients) {
    await options.email.enqueue(
      {
        idempotencyKey: `admin-enrollment-notification/${input.enrollmentId}/${input.revision}/${recipientEmail}`,
        kind: 'admin-enrollment-notification',
        recipientEmail,
        payload: {
          requesterEmail: input.email,
          requesterName: input.name,
          reason: input.reason,
          actionURL: `${options.appURL}/admin/enrollment`
        }
      },
      transaction
    )
  }
}

export async function enqueueEnrollmentReview(
  transaction: Transaction<CloudDatabase>,
  options: EnrollmentEmailOptions,
  input: {
    enrollmentId: string
    recipientEmail: string
    name: string
    status: Exclude<EnrollmentStatus, 'pending'>
    reviewedAt: Date
  }
): Promise<void> {
  if (!options.email) return
  await options.email.enqueue(
    {
      idempotencyKey: `enrollment-${input.status}/${input.enrollmentId}/${input.reviewedAt.toISOString()}`,
      kind: `enrollment-${input.status}`,
      recipientEmail: input.recipientEmail,
      payload: {
        name: input.name,
        actionURL: input.status === 'approved' ? options.appURL : `${options.appURL}/sign-in`
      }
    },
    transaction
  )
}
