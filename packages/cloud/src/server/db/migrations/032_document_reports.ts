import { CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import { sql, type Kysely } from 'kysely'

import { addCheckConstraint, replaceCheckConstraint } from './helpers'

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
  'two-step-changed'
]

const DOCUMENT_REPORT_REASONS = [
  'spam-phishing',
  'illegal',
  'copyright',
  'harassment',
  'other'
] as const

const DOCUMENT_REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const

/**
 * Reports people file about documents shared with them by link, which deployment administrators
 * review, and a document's takedown: a disabled document is out of reach for everyone, its owner
 * included, until an administrator enables it again. Administrators hear of each report by email.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('document')
    .addColumn('disabled_at', 'timestamptz')
    .addColumn('disabled_reason', 'text')
    .execute()
  await database.schema
    .createTable('document_report')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    // A link revoked later keeps its reports.
    .addColumn('share_id', 'uuid')
    // Better Auth's tables may come after this migration, so the account is not a foreign key.
    .addColumn('reporter_user_id', 'text')
    .addColumn('reporter_guest_id', 'text')
    .addColumn('reply_email', 'text')
    .addColumn('reason', 'text', (column) => column.notNull())
    .addColumn('description', 'text', (column) => column.notNull())
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolved_by', 'text')
    .execute()
  await addCheckConstraint(
    database,
    'document_report',
    'document_report_reason_check',
    'reason',
    DOCUMENT_REPORT_REASONS
  )
  await addCheckConstraint(
    database,
    'document_report',
    'document_report_status_check',
    'status',
    DOCUMENT_REPORT_STATUSES
  )
  await database.schema
    .createIndex('document_report_status_index')
    .on('document_report')
    .columns(['status', 'created_at'])
    .execute()
  await database.schema
    .createIndex('document_report_share_index')
    .on('document_report')
    .columns(['share_id', 'created_at'])
    .execute()
  await database.schema
    .createIndex('document_report_document_index')
    .on('document_report')
    .column('document_id')
    .execute()
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    [...EMAIL_KINDS, 'document-report']
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  // The narrower check refuses rows it no longer names, so report emails go first.
  await sql`delete from transactional_email where kind = 'document-report'`.execute(database)
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    EMAIL_KINDS
  )
  await database.schema.dropTable('document_report').execute()
  await database.schema
    .alterTable('document')
    .dropColumn('disabled_at')
    .dropColumn('disabled_reason')
    .execute()
}
