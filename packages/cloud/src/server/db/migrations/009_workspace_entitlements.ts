import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .createTable('workspaceEntitlement')
    .addColumn('workspaceId', 'uuid', (column) =>
      column.primaryKey().references('workspace.id').onDelete('cascade')
    )
    .addColumn('values', 'jsonb', (column) => column.notNull())
    .addColumn('source', 'text', (column) => column.notNull())
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('updatedAt', 'timestamptz', (column) => column.notNull().defaultTo(new Date()))
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.dropTable('workspaceEntitlement').execute()
}
