import type { Kysely } from 'kysely'

import { dropTables, now, required } from './schema'

/** Files in the object store, a workspace's images among them, and how much each workspace uses. */
const TABLES = ['storage_object', 'workspace_storage_usage', 'workspace_image']

export async function up(database: Kysely<unknown>): Promise<void> {
  // A stored file, by content; revisions, snapshots, and images refer to one.
  await database.schema
    .createTable('storage_object')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('object_key', 'text', (column) => column.notNull().unique())
    .addColumn('checksum', 'text', required)
    .addColumn('byte_size', 'bigint', required)
    .addColumn('content_type', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('workspace_storage_usage')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.primaryKey().references('workspace.id').onDelete('cascade')
    )
    .addColumn('committed_bytes', 'bigint', (column) => column.notNull().defaultTo(0))
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  // A workspace's images, each stored once; revisions name the ones they use.
  await database.schema
    .createTable('workspace_image')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('checksum', 'text', required)
    .addColumn('storage_object_id', 'uuid', (column) =>
      column.notNull().unique().references('storage_object.id')
    )
    .addColumn('touched_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('workspace_image_pkey', ['workspace_id', 'checksum'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}
