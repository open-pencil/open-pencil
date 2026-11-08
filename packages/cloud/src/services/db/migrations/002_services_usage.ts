import { sql, type Kysely } from 'kysely'

/**
 * The usage table takes the services name its server has, with its key and index; a database
 * created now and one upgraded from the `ai_relay_*` names end alike.
 *
 * Credits are an account's, shared by every workspace it owns, so each settled request records
 * the account it spent. Rows from before carry none; they still count this month for requests
 * from their own workspace (`spender` in `usage.ts`), since the server cannot see who owns it.
 */
const RENAMES = {
  table: ['ai_relay_usage', 'services_usage'],
  key: ['ai_relay_usage_pkey', 'services_usage_pkey'],
  index: ['ai_relay_usage_workspace_created_idx', 'services_usage_workspace_created_idx']
} as const

async function rename(database: Kysely<unknown>, direction: 'up' | 'down'): Promise<void> {
  const [tableFrom, tableTo] = direction === 'up' ? RENAMES.table : [...RENAMES.table].reverse()
  const [keyFrom, keyTo] = direction === 'up' ? RENAMES.key : [...RENAMES.key].reverse()
  const [indexFrom, indexTo] = direction === 'up' ? RENAMES.index : [...RENAMES.index].reverse()
  await database.schema.alterTable(tableFrom).renameTo(tableTo).execute()
  await database.schema.alterTable(tableTo).renameConstraint(keyFrom, keyTo).execute()
  await sql`alter index ${sql.id(indexFrom)} rename to ${sql.id(indexTo)}`.execute(database)
}

export async function up(database: Kysely<unknown>): Promise<void> {
  await rename(database, 'up')
  await database.schema.alterTable('services_usage').addColumn('account_id', 'text').execute()
  await database.schema
    .createIndex('services_usage_account_created_idx')
    .on('services_usage')
    .columns(['account_id', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropIndex('services_usage_account_created_idx').execute()
  await database.schema.alterTable('services_usage').dropColumn('account_id').execute()
  await rename(database, 'down')
}
