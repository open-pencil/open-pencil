import type { Kysely } from 'kysely'

import { addIndexes } from './schema'

/** Trash: who deleted a document, and finding a workspace's deleted documents. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document').addColumn('deleted_by', 'text').execute()
  await addIndexes(database, [['document', ['workspace_id', 'deleted_at desc']]])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropIndex('document_workspace_id_deleted_at_idx').execute()
  await database.schema.alterTable('document').dropColumn('deleted_by').execute()
}
