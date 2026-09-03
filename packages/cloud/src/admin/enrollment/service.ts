import { AdminDomainError } from '#cloud/admin/errors'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

import {
  enqueueEnrollmentRequested,
  enqueueEnrollmentReview,
  type EnrollmentEmailOptions
} from './email'

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'revoked'
export type EnrollmentMode = 'open' | 'approval' | 'closed'

export type EnrollmentRequestInput = { email: string; name?: string; reason?: string }
export type EnrollmentReviewInput = { note?: string }
export type EnrollmentRecord = {
  id: string
  email: string
  name: string | null
  reason: string | null
  status: EnrollmentStatus
  requestedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  approvedUserId: string | null
  requestRevision: number
}

type EnrollmentRow = {
  id: string
  emailNormalized: string
  name: string | null
  reason: string | null
  status: EnrollmentStatus
  requestedAt: Date | string
  reviewedAt: Date | string | null
  reviewedBy: string | null
  reviewNote: string | null
  approvedUserId: string | null
  requestRevision: number
}

const ALLOWED_TRANSITIONS: Record<EnrollmentStatus, ReadonlySet<EnrollmentStatus>> = {
  pending: new Set(['approved', 'rejected']),
  approved: new Set(['revoked']),
  rejected: new Set(['pending', 'approved']),
  revoked: new Set(['pending', 'approved'])
}

function dateString(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null
}
function enrollmentRecord(row: EnrollmentRow): EnrollmentRecord {
  return {
    id: row.id,
    email: row.emailNormalized,
    name: row.name,
    reason: row.reason,
    status: row.status,
    requestedAt: dateString(row.requestedAt) ?? '',
    reviewedAt: dateString(row.reviewedAt),
    reviewedBy: row.reviewedBy,
    reviewNote: row.reviewNote,
    approvedUserId: row.approvedUserId,
    requestRevision: row.requestRevision
  }
}
export function normalizeEnrollmentEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function createEnrollmentService(
  database: Kysely<CloudDatabase>,
  emailOptions: EnrollmentEmailOptions = { appURL: '', adminRecipients: [] }
) {
  return {
    async request(input: EnrollmentRequestInput): Promise<void> {
      const emailNormalized = normalizeEnrollmentEmail(input.email)
      await database.transaction().execute(async (transaction) => {
        const existing = await transaction
          .selectFrom('cloudEnrollment')
          .selectAll()
          .where('emailNormalized', '=', emailNormalized)
          .forUpdate()
          .executeTakeFirst()
        if (existing?.status === 'approved' || existing?.status === 'pending') return
        const revision = (existing?.requestRevision ?? 0) + 1
        const values = {
          name: input.name?.trim() || existing?.name || null,
          reason: input.reason?.trim() || null,
          status: 'pending' as const,
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          requestRevision: revision
        }
        let row: EnrollmentRow
        if (existing) {
          row = await transaction
            .updateTable('cloudEnrollment')
            .set(values)
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        } else {
          row = await transaction
            .insertInto('cloudEnrollment')
            .values({
              id: crypto.randomUUID(),
              emailNormalized,
              ...values,
              approvedUserId: null
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        }
        await enqueueEnrollmentRequested(transaction, emailOptions, {
          enrollmentId: row.id,
          email: row.emailNormalized,
          name: row.name ?? 'there',
          reason: row.reason ?? 'No reason provided.',
          revision
        })
      })
    },
    async isApproved(email: string): Promise<boolean> {
      return Boolean(
        await database
          .selectFrom('cloudEnrollment')
          .select('id')
          .where('emailNormalized', '=', normalizeEnrollmentEmail(email))
          .where('status', '=', 'approved')
          .executeTakeFirst()
      )
    },
    async list(status?: EnrollmentStatus): Promise<EnrollmentRecord[]> {
      let query = database.selectFrom('cloudEnrollment').selectAll()
      if (status) query = query.where('status', '=', status)
      return (await query.orderBy('requestedAt', 'desc').execute()).map(enrollmentRecord)
    },
    async review(
      actorId: string,
      enrollmentId: string,
      status: Exclude<EnrollmentStatus, 'pending'>,
      input: EnrollmentReviewInput
    ): Promise<EnrollmentRecord> {
      return database.transaction().execute(async (transaction) => {
        const current = await transaction
          .selectFrom('cloudEnrollment')
          .selectAll()
          .where('id', '=', enrollmentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        if (!ALLOWED_TRANSITIONS[current.status].has(status)) {
          throw new AdminDomainError(
            'invalid_enrollment_transition',
            `Enrollment cannot transition from ${current.status} to ${status}`
          )
        }
        const now = new Date()
        const row = await transaction
          .updateTable('cloudEnrollment')
          .set({
            status,
            reviewedAt: now,
            reviewedBy: actorId,
            reviewNote: input.note?.trim() || null
          })
          .where('id', '=', enrollmentId)
          .where('status', '=', current.status)
          .returningAll()
          .executeTakeFirstOrThrow()
        await transaction
          .insertInto('cloudAdminAuditEvent')
          .values({
            id: crypto.randomUUID(),
            actorUserId: actorId,
            action: `enrollment.${status}`,
            subjectType: 'enrollment',
            subjectId: enrollmentId,
            metadata: { email: row.emailNormalized },
            createdAt: now
          })
          .execute()
        await enqueueEnrollmentReview(transaction, emailOptions, {
          enrollmentId,
          recipientEmail: row.emailNormalized,
          name: row.name ?? 'there',
          status,
          reviewedAt: now
        })
        return enrollmentRecord(row)
      })
    },
    async bindApprovedUser(email: string, userId: string): Promise<void> {
      await database
        .updateTable('cloudEnrollment')
        .set({ approvedUserId: userId })
        .where('emailNormalized', '=', normalizeEnrollmentEmail(email))
        .where('status', '=', 'approved')
        .execute()
    },
    async pendingCount(): Promise<number> {
      const row = await database
        .selectFrom('cloudEnrollment')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('status', '=', 'pending')
        .executeTakeFirstOrThrow()
      return Number(row.count)
    }
  }
}
export type EnrollmentService = ReturnType<typeof createEnrollmentService>
