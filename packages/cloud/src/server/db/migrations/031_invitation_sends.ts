import { CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

/**
 * Each invitation sent, by sender and recipient, for the daily invitation budget. It is kept apart
 * from the invitations themselves, which go with their workspace or document, so deleting one
 * never gives the budget back; rows older than a day are swept with the rate limits.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('invitation_send')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('sender_id', 'text', (column) => column.notNull())
    .addColumn('email_normalized', 'text', (column) => column.notNull())
    .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(CURRENT_TIMESTAMP))
    .execute()
  await database.schema
    .createIndex('invitation_send_sender_index')
    .on('invitation_send')
    .columns(['sender_id', 'sent_at'])
    .execute()
  await database.schema
    .createIndex('invitation_send_recipient_index')
    .on('invitation_send')
    .columns(['email_normalized', 'sent_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('invitation_send').execute()
}
