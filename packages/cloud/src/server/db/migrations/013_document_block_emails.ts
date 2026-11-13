import type { Kysely } from 'kysely'

import { addChecks } from './schema'

/** Every kind of transactional email before this migration. */
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
  'document-report',
  'storage-limit-reached'
]

/**
 * Email gains the kinds that tell a workspace's owner an administrator blocked one of its
 * documents, and that it is back, which the previous release never writes.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('transactional_email')
    .dropConstraint('transactional_email_kind_check')
    .execute()
  await addChecks(database, [
    ['transactional_email', 'kind', [...EMAIL_KINDS, 'document-blocked', 'document-restored']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('transactional_email')
    .dropConstraint('transactional_email_kind_check')
    .execute()
  await addChecks(database, [['transactional_email', 'kind', EMAIL_KINDS]])
}
