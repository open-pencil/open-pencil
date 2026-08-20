import { type Kysely, sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('upload').dropConstraint('upload_status_check').execute()
  await database.schema
    .alterTable('upload')
    .addCheckConstraint(
      'upload_status_check',
      sql`status in ('pending', 'finalizing', 'cleaning', 'committed', 'abandoned')`
    )
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    alter table upload drop constraint upload_status_check;
    alter table upload add constraint upload_status_check
      check (status in ('pending', 'cleaning', 'committed', 'abandoned'))
  `.execute(database)
}
