import type { Kysely } from 'kysely'

/** Whether Better Auth's `user` table exists yet, which it doesn't before a server first starts. */
async function hasUserTable(database: Kysely<unknown>): Promise<boolean> {
  const tables = await database.introspection.getTables()
  return tables.some((table) => table.name === 'user')
}

/**
 * The language Cloud writes to each account in, and the one each queued email is written in,
 * settled when it's queued so a retry reads the same. Email from before this migration is
 * English, as it always was.
 *
 * `user.locale` is a Better Auth field, so a new database gets it from Better Auth's own schema,
 * built after Cloud's migrations. A database that already has that schema never builds it again,
 * so it gets the column here; accounts from before it have no language and read English.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('transactional_email')
    .addColumn('locale', 'text', (column) => column.notNull().defaultTo('en'))
    .execute()
  if (await hasUserTable(database)) {
    await database.schema
      .alterTable('user')
      .addColumn('locale', 'text', (column) => column.ifNotExists())
      .execute()
  }
}

// `user.locale` stays: an earlier release ignores it, and the languages accounts chose aren't lost.
export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('transactional_email').dropColumn('locale').execute()
}
