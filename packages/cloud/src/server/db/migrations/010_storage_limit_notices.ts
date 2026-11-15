import type { Kysely } from 'kysely'

import { addChecks, now } from './schema'

/** Every kind of transactional email, as of this migration. */
const EMAIL_KINDS = [
  'document-invitation',
  'workspace-invitation',
  'enrollment-requested',
  'admin-enrollment-notification',
  'enrollment-approved',
  'enrollment-rejected',
  'enrollment-revoked',
  'email-verification',
  'password-reset',
  'password-changed',
  'email-change-requested',
  'new-sign-in',
  'two-step-changed',
  'document-report'
]

/**
 * The accounts told their storage is full, so each is told once each time it fills, not on every
 * cleanup pass; a row goes once the account holds less than its plan allows again. Email gains
 * the kind that tells them, which the previous release never writes.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('storage_limit_notice')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('notified_at', 'timestamptz', now)
    .execute()
  await database.schema
    .alterTable('transactional_email')
    .dropConstraint('transactional_email_kind_check')
    .execute()
  await addChecks(database, [
    ['transactional_email', 'kind', [...EMAIL_KINDS, 'storage-limit-reached']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('transactional_email')
    .dropConstraint('transactional_email_kind_check')
    .execute()
  await addChecks(database, [['transactional_email', 'kind', EMAIL_KINDS]])
  await database.schema.dropTable('storage_limit_notice').execute()
}
