import type { Kysely } from 'kysely'

import { addCurrentTimestampColumns } from './helpers'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('cloud_enrollment')
    .addColumn('request_revision', 'integer', (column) => column.notNull().defaultTo(1))
    .execute()
  await database.schema
    .createTable('cloud_rate_limit')
    .addColumn('key_hash', 'text', (column) => column.primaryKey())
    .addColumn('window_started_at', 'timestamptz', (column) => column.notNull())
    .addColumn('request_count', 'integer', (column) => column.notNull().defaultTo(1))
    .execute()
  await addCurrentTimestampColumns(database, 'cloud_rate_limit', ['updated_at'])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_rate_limit').ifExists().execute()
  await database.schema.alterTable('cloud_enrollment').dropColumn('request_revision').execute()
}
