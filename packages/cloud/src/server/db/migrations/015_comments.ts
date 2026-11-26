import type { Kysely } from 'kysely'

import { addIndexes, dropTables, now, required } from './schema'

/**
 * Comments on a Cloud document belong to the server, not to the file: each one keeps who wrote
 * it as an account, can be deleted for good, and is open to people who may only view. A thread
 * is the pin and whether it is resolved; its comments are its first message and the replies.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('comment_thread')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('page_id', 'text', required)
    // The page and layer names when the pin was placed, for a file written without the layer.
    .addColumn('page_name', 'text')
    .addColumn('node_id', 'text')
    .addColumn('node_name', 'text')
    .addColumn('offset_x', 'double precision')
    .addColumn('offset_y', 'double precision')
    .addColumn('x', 'double precision', required)
    .addColumn('y', 'double precision', required)
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolved_by', 'text')
    .execute()
  await database.schema
    .createTable('comment')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('thread_id', 'uuid', (column) =>
      column.notNull().references('comment_thread.id').onDelete('cascade')
    )
    // The account that wrote it. A comment brought in from a file has none and keeps the name
    // the file gave instead, which no one vouches for.
    .addColumn('author_id', 'text')
    .addColumn('imported_author_name', 'text')
    // The agent that wrote it on its author's behalf, if one did.
    .addColumn('agent', 'text')
    .addColumn('body', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('edited_at', 'timestamptz')
    .execute()
  await addIndexes(database, [
    ['comment_thread', ['document_id', 'created_at']],
    ['comment', ['thread_id', 'created_at']],
    ['comment', ['author_id']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, ['comment_thread', 'comment'])
}
