import type { Kysely } from 'kysely'

import { addCheckConstraint } from './helpers'

/**
 * Whether each document is a Figma design or a FigJam board, so lists can tell them apart
 * without opening the file. Documents stored before this are designs; a board's next save says so.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('document')
    .addColumn('kind', 'text', (column) => column.notNull().defaultTo('design'))
    .execute()
  await addCheckConstraint(database, 'document', 'document_kind_check', 'kind', ['design', 'board'])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document').dropColumn('kind').execute()
}
