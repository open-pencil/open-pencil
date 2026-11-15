import type { Kysely } from 'kysely'

import { addChecks, addIndexes, dropTables, now, required } from './schema'

/** What Cloud keeps about an account beside Better Auth's tables: its plan, sign-ins, and picture. */
const TABLES = [
  'auth_schema_version',
  'account_entitlement',
  'mfa_assurance',
  'sign_in',
  'user_picture',
  'api_rate_limit'
]

export async function up(database: Kysely<unknown>): Promise<void> {
  // The Better Auth schema version this database was built for.
  await database.schema
    .createTable('auth_schema_version')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('version', 'text', required)
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  // An account's plan, as billing or an operator set it; its workspaces share it.
  await database.schema
    .createTable('account_entitlement')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('values', 'jsonb', required)
    .addColumn('source', 'text', required)
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('external_version', 'bigint')
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('mfa_assurance')
    .addColumn('session_id', 'uuid', (column) => column.primaryKey())
    .addColumn('user_id', 'uuid', required)
    .addColumn('method', 'text', required)
    .addColumn('verified_at', 'timestamptz', required)
    .execute()
  await database.schema
    .createTable('sign_in')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('user_id', 'uuid', required)
    .addColumn('session_id', 'uuid')
    .addColumn('method', 'text', required)
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('user_picture')
    .addColumn('user_id', 'uuid', (column) => column.primaryKey())
    .addColumn('bytes', 'bytea', required)
    .addColumn('format', 'text', required)
    .addColumn('checksum', 'text', required)
    .addColumn('source', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  // OpenPencil's own rate limits; Better Auth keeps its own in `rate_limit`.
  await database.schema
    .createTable('api_rate_limit')
    .addColumn('key_hash', 'text', (column) => column.primaryKey())
    .addColumn('window_started_at', 'timestamptz', required)
    .addColumn('request_count', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await addChecks(database, [
    ['user_picture', 'format', ['png', 'jpeg']],
    ['user_picture', 'source', ['upload', 'provider']]
  ])
  await addIndexes(database, [
    ['sign_in', ['user_id', 'created_at']],
    ['sign_in', ['session_id']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}
