import { sql, type Kysely } from 'kysely'

import { replaceChecks } from './schema'

/** A document can be a Slides deck. A rollback keeps decks as designs, the kind every release reads. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceChecks(database, 'widen', [['document', 'kind', ['design', 'board', 'slides']]])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`update document set kind = 'design' where kind = 'slides'`.execute(database)
  await replaceChecks(database, 'narrow', [['document', 'kind', ['design', 'board']]])
}
