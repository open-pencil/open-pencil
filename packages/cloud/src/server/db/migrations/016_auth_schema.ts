import { type Kysely, sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('cloud_auth_schema')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('version', 'text', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_auth_schema').ifExists().execute()
}
