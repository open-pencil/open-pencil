import type { CloudDatabase } from '#cloud/server/db/schema'
import type { Kysely } from 'kysely'

async function tableNames(database: Kysely<unknown>): Promise<Set<string>> {
  return new Set((await database.introspection.getTables()).map((table) => table.name))
}

export async function up(database: Kysely<unknown>): Promise<void> {
  const cloud = database as Kysely<CloudDatabase>
  const tables = await tableNames(database)
  await database.schema
    .createTable('cloud_mfa_assurance')
    .addColumn('session_id', 'text', (column) => column.primaryKey())
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('method', 'text', (column) => column.notNull())
    .addColumn('verified_at', 'timestamptz', (column) => column.notNull())
    .execute()
  if (!tables.has('user')) return

  await database.schema
    .alterTable('user')
    .addColumn('two_factor_enabled', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute()
  await database.schema
    .createTable('two_factor')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('secret', 'text', (column) => column.notNull().unique())
    .addColumn('backup_codes', 'text', (column) => column.notNull())
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('verified', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('failed_verification_count', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .execute()
  await database.schema
    .createIndex('two_factor_user_index')
    .on('two_factor')
    .column('user_id')
    .execute()
  await database.schema
    .createTable('passkey')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('name', 'text')
    .addColumn('public_key', 'text', (column) => column.notNull())
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('credential_id', 'text', (column) => column.notNull().unique())
    .addColumn('counter', 'integer', (column) => column.notNull())
    .addColumn('device_type', 'text', (column) => column.notNull())
    .addColumn('backed_up', 'boolean', (column) => column.notNull())
    .addColumn('transports', 'text')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(new Date()))
    .addColumn('aaguid', 'text')
    .execute()
  await database.schema.createIndex('passkey_user_index').on('passkey').column('user_id').execute()
  await cloud
    .updateTable('cloudAuthSchema')
    .set({ version: '1.7.2+mfa.1', updatedAt: new Date() })
    .where('id', '=', 'better-auth')
    .where('version', '=', '1.7.2')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_mfa_assurance').ifExists().execute()
  await database.schema.dropTable('passkey').ifExists().execute()
  await database.schema.dropTable('two_factor').ifExists().execute()
  const tables = await tableNames(database)
  if (tables.has('user')) {
    await database.schema.alterTable('user').dropColumn('two_factor_enabled').execute()
  }
}
