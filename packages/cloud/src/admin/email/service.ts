import type { EnrollmentStatus } from '#cloud/admin/enrollment/service'
import { AdminDomainError } from '#cloud/admin/errors'
import { ADMIN_LIST_MAXIMUM } from '#cloud/admin/schema'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import { clamp } from 'es-toolkit'
import type { Kysely } from 'kysely'

/** The enrollment status each message describes; a message is resent only while it still holds. */
const ENROLLMENT_MESSAGE_STATUS: Partial<Record<string, EnrollmentStatus>> = {
  'enrollment-requested': 'pending',
  'enrollment-approved': 'approved',
  'enrollment-rejected': 'rejected',
  'enrollment-revoked': 'revoked'
}

export function createAdminEmailService(
  database: Kysely<CloudDatabase>,
  email?: TransactionalEmailService,
  links: { publicURL: string } = { publicURL: '' }
) {
  return {
    async list(limit = 100) {
      const rows = await database
        .selectFrom('transactionalEmail')
        .select([
          'id',
          'kind',
          'recipientEmailNormalized',
          'status',
          'attemptCount',
          'nextAttemptAt',
          'transport',
          'transportMessageId',
          'lastErrorCode',
          'createdAt',
          'acceptedAt'
        ])
        .orderBy('createdAt', 'desc')
        .limit(clamp(limit, 1, ADMIN_LIST_MAXIMUM))
        .execute()
      return rows.map((row) => ({ ...row, regeneratable: row.kind.startsWith('enrollment-') }))
    },
    async regenerate(actorId: string, messageId: string): Promise<void> {
      if (!email)
        throw new AdminDomainError('email_regeneration_unavailable', 'Email delivery is disabled')
      await database.transaction().execute(async (transaction) => {
        const original = await transaction
          .selectFrom('transactionalEmail')
          .select(['id', 'kind', 'recipientEmailNormalized'])
          .where('id', '=', messageId)
          .executeTakeFirstOrThrow()
        if (
          !original.kind.startsWith('enrollment-') ||
          original.kind === 'admin-enrollment-notification'
        ) {
          throw new AdminDomainError(
            'email_regeneration_unavailable',
            'This message cannot be regenerated'
          )
        }
        const kind = original.kind
        const enrollment = await transaction
          .selectFrom('enrollment')
          .selectAll()
          .where('emailNormalized', '=', original.recipientEmailNormalized)
          .executeTakeFirst()
        if (!enrollment)
          throw new AdminDomainError('email_regeneration_unavailable', 'Enrollment is unavailable')
        if (ENROLLMENT_MESSAGE_STATUS[kind] !== enrollment.status) {
          throw new AdminDomainError(
            'email_regeneration_unavailable',
            'The enrollment no longer matches this message'
          )
        }
        await email.enqueue(
          {
            idempotencyKey: `admin-regeneration/${messageId}/${crypto.randomUUID()}`,
            kind,
            recipientEmail: enrollment.emailNormalized,
            payload: {
              name: enrollment.name ?? 'there',
              actionURL:
                kind === 'enrollment-approved'
                  ? links.publicURL
                  : new URL('/auth/sign-in', links.publicURL).href
            }
          },
          transaction
        )
        await transaction
          .insertInto('adminAuditEvent')
          .values({
            id: crypto.randomUUID(),
            actorUserId: actorId,
            action: 'email.regenerated',
            subjectType: 'transactional-email',
            subjectId: messageId,
            metadata: { replacementKind: kind }
          })
          .execute()
      })
    }
  }
}

export type AdminEmailService = ReturnType<typeof createAdminEmailService>
