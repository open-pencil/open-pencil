import type { Kysely } from 'kysely'

import { addCurrentTimestampColumns } from './helpers'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('cloud_auth_schema')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('version', 'text', (column) => column.notNull())
    .execute()
  await addCurrentTimestampColumns(database, 'cloud_auth_schema', ['updated_at'])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_auth_schema').ifExists().execute()
}
