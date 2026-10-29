import { checkColumnIn, CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

/**
 * The picture each account shows, kept by the server so pages never load one from another
 * service: one uploaded by its owner, or the one a linked Google account gave it, copied at sign-in.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('user_picture')
    // Better Auth's tables may come after this migration, so the account is not a foreign key.
    .addColumn('user_id', 'uuid', (column) => column.primaryKey())
    .addColumn('bytes', 'bytea', (column) => column.notNull())
    .addColumn('format', 'text', (column) => column.notNull())
    .addColumn('checksum', 'text', (column) => column.notNull())
    .addColumn('source', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addCheckConstraint('user_picture_format_check', checkColumnIn('format', ['png', 'jpeg']))
    .addCheckConstraint(
      'user_picture_source_check',
      checkColumnIn('source', ['upload', 'provider'])
    )
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('user_picture').execute()
}
