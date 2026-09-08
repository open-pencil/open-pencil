import { AdminDomainError } from '#cloud/admin/errors'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Kysely } from 'kysely'

export function createAdminEmailService(
  database: Kysely<CloudDatabase>,
  email?: TransactionalEmailService,
  appURL = ''
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
        .limit(Math.min(Math.max(limit, 1), 500))
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
          .selectFrom('cloudEnrollment')
          .selectAll()
          .where('emailNormalized', '=', original.recipientEmailNormalized)
          .executeTakeFirst()
        if (!enrollment)
          throw new AdminDomainError('email_regeneration_unavailable', 'Enrollment is unavailable')
        await email.enqueue(
          {
            idempotencyKey: `admin-regeneration/${messageId}/${crypto.randomUUID()}`,
            kind,
            recipientEmail: enrollment.emailNormalized,
            payload: {
              name: enrollment.name ?? 'there',
              actionURL: kind === 'enrollment-approved' ? appURL : `${appURL}/auth/sign-in`
            }
          },
          transaction
        )
        await transaction
          .insertInto('cloudAdminAuditEvent')
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
