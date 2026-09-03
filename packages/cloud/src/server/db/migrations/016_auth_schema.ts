import { type Kysely, sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table cloud_auth_schema (
      id text primary key,
      version text not null,
      updated_at timestamptz not null default now()
    )
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_auth_schema').ifExists().execute()
}
