import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Transaction } from 'kysely'

import type { EnrollmentStatus } from './service'

export type EnrollmentEmailOptions = {
  /**
   * The server's address: its editor, where an approved account goes next, and its own pages,
   * where people sign in and administrators review requests.
   */
  publicURL: string
  adminRecipients: string[]
  email?: TransactionalEmailService
  /**
   * Whether an approval may carry the founder's letter (`enrollment-invited`) instead of the
   * plain approval: only on the official deployment, whose letter it is.
   */
  invitations?: boolean
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
      payload: { name: input.name, actionURL: new URL('/auth/sign-in', options.publicURL).href }
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
          actionURL: new URL('/admin/requests', options.publicURL).href
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
    /** An approval that sends the letter instead of the plain approval. */
    invite?: boolean
    /** The person joined openpencil.dev's waitlist rather than asking here; the letter says so. */
    waitlist?: boolean
  }
): Promise<void> {
  if (!options.email) return
  const kind =
    input.status === 'approved' && input.invite
      ? ('enrollment-invited' as const)
      : (`enrollment-${input.status}` as const)
  await options.email.enqueue(
    {
      idempotencyKey: `${kind}/${input.enrollmentId}/${input.reviewedAt.toISOString()}`,
      kind,
      recipientEmail: input.recipientEmail,
      payload: {
        name: input.name,
        actionURL:
          input.status === 'approved'
            ? options.publicURL
            : new URL('/auth/sign-in', options.publicURL).href,
        ...(kind === 'enrollment-invited' && input.waitlist && { waitlist: true as const })
      }
    },
    transaction
  )
}
