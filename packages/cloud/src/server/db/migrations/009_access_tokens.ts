import { sql, type Kysely } from 'kysely'

import { addIndexes, required } from './schema'

/**
 * Personal access tokens, kept by Better Auth's API-key plugin in the table it would build
 * itself. Cloud builds it here instead, since Better Auth's tables are built only once and a
 * deployment that has them gains this one as any other migration; Better Auth's migration then
 * leaves this plugin's table out (`createBetterAuthAdapter`). It holds each token's SHA-256
 * digest, never the token.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('apikey')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('config_id', 'text', required)
    .addColumn('name', 'text')
    .addColumn('start', 'text')
    .addColumn('reference_id', 'text', required)
    .addColumn('prefix', 'text')
    .addColumn('key', 'text', required)
    .addColumn('refill_interval', 'integer')
    .addColumn('refill_amount', 'integer')
    .addColumn('last_refill_at', 'timestamptz')
    .addColumn('enabled', 'boolean')
    .addColumn('rate_limit_enabled', 'boolean')
    .addColumn('rate_limit_time_window', 'integer')
    .addColumn('rate_limit_max', 'integer')
    .addColumn('request_count', 'integer')
    .addColumn('remaining', 'integer')
    .addColumn('last_request', 'timestamptz')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', required)
    .addColumn('updated_at', 'timestamptz', required)
    .addColumn('permissions', 'text')
    .addColumn('metadata', 'text')
    .execute()
  await addIndexes(database, [
    ['apikey', ['config_id']],
    ['apikey', ['reference_id']],
    ['apikey', ['key']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('apikey').execute()
}
