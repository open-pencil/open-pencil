import type { Kysely } from 'kysely'

import type { LegacyAuthSchemaDatabase } from './helpers'

/** The unique index Better Auth 1.7.0 through 1.7.2 created on `account (issuer, accountId)`. */
const ISSUER_INDEX = 'account_issuer_accountId_uidx'

/**
 * Better Auth 1.7.3 dropped the required `account.issuer` column that 1.7.0 through 1.7.2 added,
 * and no longer writes it, so a schema created on 1.7.2 would refuse every new account. Following
 * Better Auth's 1.7 upgrade guide, the column becomes optional and its unique index goes; the
 * column itself is left for a later cleanup.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  const cloud = database as Kysely<LegacyAuthSchemaDatabase>
  const account = (await database.introspection.getTables()).find(
    (table) => table.name === 'account'
  )
  if (account?.columns.some((column) => column.name === 'issuer')) {
    await database.schema.dropIndex(ISSUER_INDEX).ifExists().execute()
    await database.schema
      .alterTable('account')
      .alterColumn('issuer', (column) => column.dropNotNull())
      .execute()
  }
  await cloud
    .updateTable('cloudAuthSchema')
    .set({ version: '1.7.7+mfa.1', updatedAt: new Date() })
    .where('id', '=', 'better-auth')
    .where('version', '=', '1.7.2+mfa.1')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  const cloud = database as Kysely<LegacyAuthSchemaDatabase>
  await cloud
    .updateTable('cloudAuthSchema')
    .set({ version: '1.7.2+mfa.1', updatedAt: new Date() })
    .where('id', '=', 'better-auth')
    .where('version', '=', '1.7.7+mfa.1')
    .execute()
}
