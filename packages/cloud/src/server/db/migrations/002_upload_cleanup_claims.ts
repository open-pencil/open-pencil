import { type Kysely, sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('upload')
    .addColumn('cleanup_claim_id', 'uuid')
    .addColumn('cleanup_claimed_at', 'timestamptz')
    .execute()
  await database.schema.alterTable('upload').dropConstraint('upload_status_check').execute()
  await database.schema
    .alterTable('upload')
    .addCheckConstraint(
      'upload_status_check',
      sql`status in ('pending', 'cleaning', 'committed', 'abandoned')`
    )
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('upload').dropConstraint('upload_status_check').execute()
  await database.schema
    .alterTable('upload')
    .addCheckConstraint('upload_status_check', sql`status in ('pending', 'committed', 'abandoned')`)
    .execute()
  await database.schema
    .alterTable('upload')
    .dropColumn('cleanup_claimed_at')
    .dropColumn('cleanup_claim_id')
    .execute()
}
