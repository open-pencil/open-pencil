import { EMPTY_JSON_OBJECT } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

import { addChecks, addIndexes, dropTables, now, required } from './schema'

/** Running the deployment: the email outbox, enrollment, reports, and the administrators' log. */
const TABLES = ['transactional_email', 'enrollment', 'document_report', 'admin_audit_event']

export async function up(database: Kysely<unknown>): Promise<void> {
  // The email outbox; a payload is encrypted until it is sent.
  await database.schema
    .createTable('transactional_email')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('idempotency_key', 'text', (column) => column.notNull().unique())
    .addColumn('kind', 'text', required)
    .addColumn('recipient_email_normalized', 'text', required)
    .addColumn('payload_encrypted', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('next_attempt_at', 'timestamptz', now)
    .addColumn('claim_id', 'uuid')
    .addColumn('claimed_at', 'timestamptz')
    .addColumn('transport', 'text')
    .addColumn('transport_message_id', 'text')
    .addColumn('last_error_code', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('accepted_at', 'timestamptz')
    .execute()
  await database.schema
    .createTable('enrollment')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email_normalized', 'text', (column) => column.notNull().unique())
    .addColumn('name', 'text')
    .addColumn('reason', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('request_revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('requested_at', 'timestamptz', now)
    .addColumn('reviewed_at', 'timestamptz')
    .addColumn('reviewed_by', 'text')
    .addColumn('review_note', 'text')
    .addColumn('approved_user_id', 'text')
    .execute()
  // What someone reported about a shared document, and what an administrator did about it.
  await database.schema
    .createTable('document_report')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('share_id', 'uuid')
    .addColumn('reporter_user_id', 'text')
    .addColumn('reporter_guest_id', 'text')
    .addColumn('reply_email', 'text')
    .addColumn('reason', 'text', required)
    .addColumn('description', 'text', required)
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolved_by', 'text')
    .execute()
  await database.schema
    .createTable('admin_audit_event')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('actor_user_id', 'text', required)
    .addColumn('action', 'text', required)
    .addColumn('subject_type', 'text', required)
    .addColumn('subject_id', 'text', required)
    .addColumn('metadata', 'jsonb', (column) => column.notNull().defaultTo(EMPTY_JSON_OBJECT))
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  await addChecks(database, [
    [
      'transactional_email',
      'kind',
      [
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
    ],
    ['transactional_email', 'status', ['pending', 'sending', 'accepted', 'failed', 'suppressed']],
    ['enrollment', 'status', ['pending', 'approved', 'rejected', 'revoked']],
    ['document_report', 'reason', ['spam-phishing', 'illegal', 'copyright', 'harassment', 'other']],
    ['document_report', 'status', ['open', 'dismissed', 'actioned']]
  ])
  await addIndexes(database, [
    ['transactional_email', ['status', 'next_attempt_at']],
    ['enrollment', ['status', 'requested_at']],
    ['document_report', ['document_id']],
    ['document_report', ['share_id', 'created_at']],
    ['document_report', ['status', 'created_at']],
    ['admin_audit_event', ['created_at']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}
