import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

import { normalizeEnrollmentEmail } from './enrollment/service'

/** Who the audit trail names for what the admin command did, since no account did it. */
export const ADMIN_BOOTSTRAP_ACTOR = 'cli-bootstrap'

/**
 * Approves an email's enrollment from the admin command, whether or not that person has asked
 * yet, for a deployment with no administrator to approve it in the console.
 */
export async function approveEnrollmentByEmail(
  database: Kysely<CloudDatabase>,
  email: string
): Promise<string> {
  const normalized = normalizeEnrollmentEmail(email)
  const review = {
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: ADMIN_BOOTSTRAP_ACTOR,
    reviewNote: 'Approved through CLI bootstrap'
  } as const
  await database
    .insertInto('enrollment')
    .values({ id: crypto.randomUUID(), emailNormalized: normalized, ...review })
    .onConflict((conflict) => conflict.column('emailNormalized').doUpdateSet(review))
    .execute()
  return normalized
}

/**
 * Makes an existing account a deployment administrator from the admin command, recorded in the
 * audit trail as the console records a grant. The account exists once its person has signed in.
 */
export async function grantDeploymentAdminByEmail(
  database: Kysely<CloudDatabase>,
  email: string
): Promise<{ email: string; userId: string }> {
  const normalized = normalizeEnrollmentEmail(email)
  return await database.transaction().execute(async (transaction) => {
    const user = await transaction
      .updateTable('user')
      .set({ role: 'admin' })
      .where('email', '=', normalized)
      .returning('id')
      .executeTakeFirst()
    if (!user) {
      throw new Error(`No account uses ${normalized}; that person signs in once first`)
    }
    await transaction
      .insertInto('adminAuditEvent')
      .values({
        id: crypto.randomUUID(),
        actorUserId: ADMIN_BOOTSTRAP_ACTOR,
        action: 'user.admin-granted',
        subjectType: 'user',
        subjectId: user.id,
        metadata: { email: normalized }
      })
      .execute()
    return { email: normalized, userId: user.id }
  })
}
