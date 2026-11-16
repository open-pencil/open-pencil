import { AdminDomainError } from '#cloud/admin/errors'
import {
  containsPattern,
  countEachFilter,
  listSearch,
  listWindow,
  type AdminListQuery,
  type ListFilters
} from '#cloud/admin/list'
import { isUUID } from '#cloud/admin/schema'
import { enrollmentStatusSchema } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { compact, uniq } from 'es-toolkit'
import type { Kysely } from 'kysely'

import {
  enqueueEnrollmentRequested,
  enqueueEnrollmentReview,
  type EnrollmentEmailOptions
} from './email'

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'revoked'
export type EnrollmentMode = 'open' | 'approval' | 'closed'

export type EnrollmentRequestInput = { email: string; name?: string; reason?: string }
export type EnrollmentReviewInput = {
  note?: string
  /** An approval that sends the founder's letter instead of the plain approval. */
  invite?: boolean
  /**
   * The status the reviewer saw, checked under the row's lock: a request another administrator
   * decided meanwhile is refused rather than decided again.
   */
  expectedStatus?: EnrollmentStatus
}
export type EnrollmentRecord = {
  id: string
  email: string
  name: string | null
  reason: string | null
  status: EnrollmentStatus
  requestedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  reviewerName?: string | null
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

/** Requests by their status; each is in exactly one. */
const FILTERS: ListFilters<EnrollmentStatus, 'enrollment'> = {
  pending: (expression) => expression('status', '=', 'pending'),
  approved: (expression) => expression('status', '=', 'approved'),
  rejected: (expression) => expression('status', '=', 'rejected'),
  revoked: (expression) => expression('status', '=', 'revoked')
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
  emailOptions: EnrollmentEmailOptions = { publicURL: '', adminRecipients: [] }
) {
  const statusForEmail = async (email: string): Promise<EnrollmentStatus | null> => {
    const row = await database
      .selectFrom('enrollment')
      .select('status')
      .where('emailNormalized', '=', normalizeEnrollmentEmail(email))
      .executeTakeFirst()
    return row?.status ?? null
  }
  const service = {
    async request(input: EnrollmentRequestInput): Promise<void> {
      const emailNormalized = normalizeEnrollmentEmail(input.email)
      await database.transaction().execute(async (transaction) => {
        const existing = await transaction
          .selectFrom('enrollment')
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
            .updateTable('enrollment')
            .set(values)
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        } else {
          row = await transaction
            .insertInto('enrollment')
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
    statusForEmail,
    async isApproved(email: string): Promise<boolean> {
      return (await statusForEmail(email)) === 'approved'
    },
    /** A page of requests in one status, newest first, with how many match the search in each. */
    async list(query: AdminListQuery<EnrollmentStatus> = {}) {
      const search = listSearch(query)
      const status = query.filter ?? 'pending'
      const { limit, offset } = listWindow(query)
      let searched = database.selectFrom('enrollment')
      if (search) {
        const pattern = containsPattern(search)
        searched = searched.where((expression) =>
          expression.or([
            expression('name', 'ilike', pattern),
            expression('emailNormalized', 'ilike', pattern)
          ])
        )
      }
      const counts = await countEachFilter(searched, enrollmentStatusSchema.options, FILTERS)
      const rows = await searched
        .where(FILTERS[status])
        .selectAll()
        .orderBy('requestedAt', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
      // Reviewers are named by account ID; anything else names no one.
      const reviewerIds = uniq(compact(rows.map((row) => row.reviewedBy))).filter(isUUID)
      const reviewers = reviewerIds.length
        ? await database
            .selectFrom('user')
            .select(['id', 'name'])
            .where('id', 'in', reviewerIds)
            .execute()
        : []
      const names = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]))
      const enrollments = rows.map((row) => ({
        ...enrollmentRecord(row),
        reviewerName: row.reviewedBy ? (names.get(row.reviewedBy) ?? null) : null
      }))
      return { enrollments, total: counts[status], counts }
    },
    async review(
      actorId: string,
      enrollmentId: string,
      status: Exclude<EnrollmentStatus, 'pending'>,
      input: EnrollmentReviewInput
    ): Promise<EnrollmentRecord> {
      return database.transaction().execute(async (transaction) => {
        const current = await transaction
          .selectFrom('enrollment')
          .selectAll()
          .where('id', '=', enrollmentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        if (
          !ALLOWED_TRANSITIONS[current.status].has(status) ||
          (input.expectedStatus !== undefined && current.status !== input.expectedStatus)
        ) {
          throw new AdminDomainError(
            'invalid_enrollment_transition',
            `Enrollment cannot transition from ${current.status} to ${status}`
          )
        }
        const now = new Date()
        const approvedUser =
          status === 'approved'
            ? await transaction
                .selectFrom('user')
                .select('id')
                .where('email', '=', current.emailNormalized)
                .executeTakeFirst()
            : undefined
        const row = await transaction
          .updateTable('enrollment')
          .set({
            status,
            reviewedAt: now,
            reviewedBy: actorId,
            reviewNote: input.note?.trim() || null,
            approvedUserId: approvedUser?.id ?? current.approvedUserId
          })
          .where('id', '=', enrollmentId)
          .where('status', '=', current.status)
          .returningAll()
          .executeTakeFirstOrThrow()
        await transaction
          .insertInto('adminAuditEvent')
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
          reviewedAt: now,
          invite: input.invite
        })
        return enrollmentRecord(row)
      })
    },
    /**
     * Approves every waiting request and sends each person the founder's letter instead of the
     * plain approval, on the official deployment. Each approval is its own review, so one that
     * another administrator decided meanwhile is skipped rather than undoing the rest.
     */
    async invitePending(actorId: string): Promise<{ invited: number }> {
      if (!emailOptions.invitations) {
        throw new AdminDomainError(
          'invitations_unavailable',
          'Only the official deployment sends invitation letters'
        )
      }
      const pending = await database
        .selectFrom('enrollment')
        .select('id')
        .where('status', '=', 'pending')
        .orderBy('requestedAt')
        .execute()
      let invited = 0
      for (const { id } of pending) {
        try {
          await service.review(actorId, id, 'approved', {
            invite: true,
            expectedStatus: 'pending'
          })
          invited++
        } catch (error) {
          if (!(error instanceof AdminDomainError)) throw error
        }
      }
      return { invited }
    },
    async bindApprovedUser(email: string, userId: string): Promise<void> {
      await database
        .updateTable('enrollment')
        .set({ approvedUserId: userId })
        .where('emailNormalized', '=', normalizeEnrollmentEmail(email))
        .where('status', '=', 'approved')
        .execute()
    },
    /**
     * Moves an approved account's enrollment to the address it changed to, so the approval stays
     * with the account rather than with an address it no longer uses. Any other request from the
     * new address gives way to it.
     */
    async followEmailChange(userId: string, email: string): Promise<void> {
      const emailNormalized = normalizeEnrollmentEmail(email)
      await database.transaction().execute(async (transaction) => {
        const approved = await transaction
          .selectFrom('enrollment')
          .select(['id', 'emailNormalized'])
          .where('approvedUserId', '=', userId)
          .where('status', '=', 'approved')
          .forUpdate()
          .executeTakeFirst()
        if (!approved || approved.emailNormalized === emailNormalized) return
        await transaction
          .deleteFrom('enrollment')
          .where('emailNormalized', '=', emailNormalized)
          .where('id', '!=', approved.id)
          .execute()
        await transaction
          .updateTable('enrollment')
          .set({ emailNormalized })
          .where('id', '=', approved.id)
          .execute()
      })
    },
    async pendingCount(): Promise<number> {
      const row = await database
        .selectFrom('enrollment')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('status', '=', 'pending')
        .executeTakeFirstOrThrow()
      return Number(row.count)
    }
  }
  return service
}
export type EnrollmentService = ReturnType<typeof createEnrollmentService>
