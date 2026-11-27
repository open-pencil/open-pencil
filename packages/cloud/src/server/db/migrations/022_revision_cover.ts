import type { Kysely } from 'kysely'

/**
 * A revision's cover: the checksum of a workspace image the editor drew of the file when it saved
 * it, at the size the gallery and link previews show. Revisions saved without one, such as those
 * a collaborative room writes, have none and show the thumbnail inside the file instead.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('document_revision')
    .addColumn('cover_checksum', 'text')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('document_revision').dropColumn('cover_checksum').execute()
}
