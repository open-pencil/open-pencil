import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .createTable('documentCollaborationState')
    .addColumn('documentId', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('roomEpoch', 'integer', (column) => column.notNull())
    .addColumn('state', 'bytea', (column) => column.notNull())
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('createdAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .addColumn('updatedAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .addPrimaryKeyConstraint('documentCollaborationStatePrimary', ['documentId', 'roomEpoch'])
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.dropTable('documentCollaborationState').execute()
}
