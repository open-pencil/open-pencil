import type { Kysely } from 'kysely'

import { COMMENT_EMAIL_KINDS } from './016_comment_notifications'
import { replaceChecks } from './schema'

/**
 * Email gains the official deployment's invitation letter, which approves a waiting request with a
 * note from the founder instead of the plain approval; the previous release never writes it.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'widen', [
    ['transactional_email', 'kind', [...COMMENT_EMAIL_KINDS, 'enrollment-invited']]
  ])
}

// Narrowing back checks every row, so a rollback refuses while an invitation letter is kept.
export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'narrow', [['transactional_email', 'kind', COMMENT_EMAIL_KINDS]])
}
