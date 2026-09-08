import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .alterTable('document')
    .addColumn('collaborationEpoch', 'integer', (column) => column.notNull().defaultTo(0))
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.alterTable('document').dropColumn('collaborationEpoch').execute()
}
