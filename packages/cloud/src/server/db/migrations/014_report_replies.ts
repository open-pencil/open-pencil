import type { Kysely } from 'kysely'

import { DOCUMENT_BLOCK_EMAIL_KINDS } from './013_document_block_emails'
import { replaceChecks } from './schema'

/**
 * Whoever reports a document and leaves an address hears that the report arrived and what the
 * administrators decided. A report keeps the language its reporter's browser asked for, since a
 * guest has no account to say it, and email gains the two kinds, which the previous release
 * never writes.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document_report').addColumn('reply_locale', 'text').execute()
  await replaceChecks(database, 'widen', [
    [
      'transactional_email',
      'kind',
      [...DOCUMENT_BLOCK_EMAIL_KINDS, 'document-report-received', 'document-report-decided']
    ]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'narrow', [
    ['transactional_email', 'kind', DOCUMENT_BLOCK_EMAIL_KINDS]
  ])
  await database.schema.alterTable('document_report').dropColumn('reply_locale').execute()
}
