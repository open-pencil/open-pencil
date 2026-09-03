import { checkColumnIn, CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('transactional_email')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('idempotency_key', 'text', (column) => column.notNull().unique())
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('recipient_email_normalized', 'text', (column) => column.notNull())
    .addColumn('payload_encrypted', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('next_attempt_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addColumn('claim_id', 'uuid')
    .addColumn('claimed_at', 'timestamptz')
    .addColumn('transport', 'text')
    .addColumn('transport_message_id', 'text')
    .addColumn('last_error_code', 'text')
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addColumn('updated_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addColumn('accepted_at', 'timestamptz')
    .addCheckConstraint(
      'transactional_email_kind_check',
      checkColumnIn('kind', ['document-invitation'])
    )
    .addCheckConstraint(
      'transactional_email_status_check',
      checkColumnIn('status', ['pending', 'sending', 'accepted', 'failed', 'suppressed'])
    )
    .execute()

  await database.schema
    .createIndex('transactional_email_delivery_index')
    .on('transactional_email')
    .columns(['status', 'next_attempt_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('transactional_email').ifExists().execute()
}
