import type { Kysely } from 'kysely'

import { DOCUMENT_BLOCK_EMAIL_KINDS } from './013_document_block_emails'
import { addChecks, addIndexes, dropTables, now, replaceChecks, required } from './schema'

/** The kinds `014_report_replies` left email with. */
const REPORT_REPLY_EMAIL_KINDS = [
  ...DOCUMENT_BLOCK_EMAIL_KINDS,
  'document-report-received',
  'document-report-decided'
]

export const COMMENT_EMAIL_SETTINGS = ['all', 'mentions', 'off']

/**
 * Who a comment names, who has read a thread up to when, and which comments each account hears
 * about by email: everything in threads it takes part in, only what names it, or nothing. Email
 * gains the kind that tells someone, which the previous release never writes.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('comment_mention')
    .addColumn('comment_id', 'uuid', (column) =>
      column.notNull().references('comment.id').onDelete('cascade')
    )
    .addColumn('user_id', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('comment_mention_pkey', ['comment_id', 'user_id'])
    .execute()
  await database.schema
    .createTable('comment_read')
    .addColumn('user_id', 'text', required)
    .addColumn('thread_id', 'uuid', (column) =>
      column.notNull().references('comment_thread.id').onDelete('cascade')
    )
    .addColumn('read_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('comment_read_pkey', ['user_id', 'thread_id'])
    .execute()
  // An email sent about a comment, for each day's budget: who wrote it, and to whom.
  await database.schema
    .createTable('comment_email')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('sender_id', 'text', required)
    .addColumn('recipient_id', 'text', required)
    .addColumn('sent_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('notification_setting')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('comment_emails', 'text', required)
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await addChecks(database, [['notification_setting', 'comment_emails', COMMENT_EMAIL_SETTINGS]])
  await addIndexes(database, [
    ['comment_mention', ['user_id']],
    ['comment_read', ['thread_id']],
    ['comment_email', ['sender_id', 'sent_at']],
    ['comment_email', ['recipient_id', 'sent_at']]
  ])
  await replaceChecks(database, 'widen', [
    ['transactional_email', 'kind', [...REPORT_REPLY_EMAIL_KINDS, 'comment-notification']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'narrow', [
    ['transactional_email', 'kind', REPORT_REPLY_EMAIL_KINDS]
  ])
  await dropTables(database, [
    'comment_mention',
    'comment_read',
    'comment_email',
    'notification_setting'
  ])
}
