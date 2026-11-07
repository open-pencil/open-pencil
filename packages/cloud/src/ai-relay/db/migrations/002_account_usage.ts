import type { Kysely } from 'kysely'

/**
 * Credits are an account's, shared by every workspace it owns, so each settled request records
 * the account it spent. Rows from before carry none; they still count this month for requests
 * from their own workspace (`spender` in `usage.ts`), since the relay cannot see who owns it.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('ai_relay_usage').addColumn('account_id', 'text').execute()
  await database.schema
    .createIndex('ai_relay_usage_account_created_idx')
    .on('ai_relay_usage')
    .columns(['account_id', 'created_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropIndex('ai_relay_usage_account_created_idx').execute()
  await database.schema.alterTable('ai_relay_usage').dropColumn('account_id').execute()
}
