import type { Kysely } from 'kysely'

import { addIndexes } from './schema'

/**
 * Trash: who deleted a document, and who deleted it forever, when, and the storage that took off
 * its workspace's usage while its files wait out the grace before cleanup destroys them.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('document')
    .addColumn('deleted_by', 'text')
    .addColumn('purged_at', 'timestamptz')
    .addColumn('purged_by', 'text')
    .addColumn('purged_bytes', 'bigint', (column) => column.notNull().defaultTo(0))
    .execute()
  await addIndexes(database, [
    ['document', ['workspace_id', 'deleted_at desc']],
    ['document', ['purged_at']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropIndex('document_purged_at_idx').execute()
  await database.schema.dropIndex('document_workspace_id_deleted_at_idx').execute()
  await database.schema
    .alterTable('document')
    .dropColumn('purged_bytes')
    .dropColumn('purged_by')
    .dropColumn('purged_at')
    .dropColumn('deleted_by')
    .execute()
}
