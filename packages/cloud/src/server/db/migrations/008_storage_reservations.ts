import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .createTable('workspaceStorageUsage')
    .addColumn('workspaceId', 'uuid', (column) =>
      column.primaryKey().references('workspace.id').onDelete('cascade')
    )
    .addColumn('committedBytes', 'bigint', (column) => column.notNull().defaultTo(0))
    .addColumn('updatedAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .execute()
  await database.schema
    .createTable('uploadStorageReservation')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspaceId', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('uploadId', 'uuid', (column) =>
      column.notNull().unique().references('upload.id').onDelete('cascade')
    )
    .addColumn('bytes', 'bigint', (column) => column.notNull())
    .addColumn('expiresAt', 'timestamptz', (column) => column.notNull())
    .addColumn('committedAt', 'timestamptz')
    .addColumn('releasedAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.dropTable('uploadStorageReservation').execute()
  await database.schema.dropTable('workspaceStorageUsage').execute()
}
