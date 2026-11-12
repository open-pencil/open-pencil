import type { Kysely } from 'kysely'

/**
 * The language each queued email is written in, settled when it's queued so a retry reads the
 * same. Email from before this migration is English, as it always was. The account's own
 * language is Better Auth's `user.locale` field, which its schema adds.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('transactional_email')
    .addColumn('locale', 'text', (column) => column.notNull().defaultTo('en'))
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('transactional_email').dropColumn('locale').execute()
}
