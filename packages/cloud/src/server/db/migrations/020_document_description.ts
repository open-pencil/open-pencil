import type { Kysely } from 'kysely'

/**
 * A document's description: a few sentences on what the file is, which the community gallery's
 * pages show and give search engines. Empty for every document until someone sets one.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document').addColumn('description', 'text').execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document').dropColumn('description').execute()
}
