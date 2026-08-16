import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .createTable('invitationContinuation')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('invitationId', 'uuid', (column) =>
      column.notNull().references('documentInvitation.id').onDelete('cascade')
    )
    .addColumn('tokenEncrypted', 'text', (column) => column.notNull())
    .addColumn('expiresAt', 'timestamptz', (column) => column.notNull())
    .addColumn('consumedAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .execute()
  await database.schema
    .createIndex('invitationContinuationExpiryIndex')
    .on('invitationContinuation')
    .column('expiresAt')
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.dropTable('invitationContinuation').execute()
}
