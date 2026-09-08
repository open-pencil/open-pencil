import { type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('upload')
    .addColumn('finalization_started_at', 'timestamptz')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('upload').dropColumn('finalization_started_at').execute()
}
