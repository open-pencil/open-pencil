import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('document')
    .addColumn('cleanup_claim_id', 'uuid')
    .addColumn('cleanup_claimed_at', 'timestamptz')
    .execute()
  await database.schema
    .createIndex('document_cleanup_index')
    .on('document')
    .columns(['deleted_at', 'cleanup_claimed_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropIndex('document_cleanup_index').ifExists().execute()
  await database.schema
    .alterTable('document')
    .dropColumn('cleanup_claimed_at')
    .dropColumn('cleanup_claim_id')
    .execute()
}
