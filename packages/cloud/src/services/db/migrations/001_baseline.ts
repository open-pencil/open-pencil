import { CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

/**
 * One row per settled model request. An account's monthly spend is the sum of its rows across the
 * workspaces it owns; a row from a token that named no account counts for its workspace.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('services_usage')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspace_id', 'uuid', (column) => column.notNull())
    .addColumn('account_id', 'text')
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('model_id', 'text', (column) => column.notNull())
    .addColumn('input_tokens', 'integer', (column) => column.notNull())
    .addColumn('output_tokens', 'integer', (column) => column.notNull())
    .addColumn('credits', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .execute()
  await database.schema
    .createIndex('services_usage_workspace_id_created_at_id_idx')
    .on('services_usage')
    .columns(['workspace_id', 'created_at desc', 'id desc'])
    .execute()
  await database.schema
    .createIndex('services_usage_account_id_created_at_idx')
    .on('services_usage')
    .columns(['account_id', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('services_usage').ifExists().execute()
}
