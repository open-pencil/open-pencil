import type { Kysely } from 'kysely'

import { replaceChecks } from './schema'

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

/** Every kind of transactional email once this migration has run. */
export const DOCUMENT_BLOCK_EMAIL_KINDS = [...EMAIL_KINDS, 'document-blocked', 'document-restored']

/**
 * Email gains the kinds that tell a workspace's owner an administrator blocked one of its
 * documents, and that it is back, which the previous release never writes.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'widen', [
    ['transactional_email', 'kind', DOCUMENT_BLOCK_EMAIL_KINDS]
  ])
}

// Narrowing back checks every row, so a rollback refuses while any email of the new kinds is kept.
export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'narrow', [['transactional_email', 'kind', EMAIL_KINDS]])
}
