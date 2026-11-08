import { addCurrentTimestampColumns } from '#cloud/server/db/migrations/helpers'
import type { Kysely } from 'kysely'

/** One row per settled model request; a workspace's monthly spend is the sum of its rows. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('ai_relay_usage')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspace_id', 'uuid', (column) => column.notNull())
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('model_id', 'text', (column) => column.notNull())
    .addColumn('input_tokens', 'integer', (column) => column.notNull())
    .addColumn('output_tokens', 'integer', (column) => column.notNull())
    .addColumn('credits', 'integer', (column) => column.notNull())
    .execute()
  await addCurrentTimestampColumns(database, 'ai_relay_usage', ['created_at'])
  await database.schema
    .createIndex('ai_relay_usage_workspace_created_idx')
    .on('ai_relay_usage')
    .columns(['workspace_id', 'created_at desc', 'id desc'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('ai_relay_usage').ifExists().execute()
}
