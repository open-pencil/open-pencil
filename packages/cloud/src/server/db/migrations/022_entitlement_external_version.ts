import type { CloudDatabase } from '#cloud/server/db/tables'
import type { Kysely } from 'kysely'

/**
 * The version an external writer, such as a billing service, attached to a workspace's
 * entitlements. Writers deliver out of order, so a write older than the stored one is refused.
 */
export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .alterTable('workspaceEntitlement')
    .addColumn('externalVersion', 'bigint')
    .execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.alterTable('workspaceEntitlement').dropColumn('externalVersion').execute()
}
