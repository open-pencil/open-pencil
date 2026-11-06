import type { CloudDatabase } from '#cloud/server/db/tables'
import { sql, type Kysely } from 'kysely'

/**
 * Moves each workspace's stored `ai` entitlements to `services`, which now names the AI service
 * together with the other paid services Cloud signs tokens for. One statement renames the key in
 * place, so it reads no rows into memory and cannot overwrite a write that lands meanwhile.
 */
async function moveEntitlements(database: Kysely<CloudDatabase>, from: string, to: string) {
  await sql`
    update ${sql.table('workspaceEntitlement')}
    set ${sql.ref('values')} =
      (${sql.ref('values')} - ${from}::text) || jsonb_build_object(${to}::text, ${sql.ref('values')} -> ${from}::text)
    where ${sql.ref('values')} ? ${from}::text
  `.execute(database)
}

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await moveEntitlements(database, 'ai', 'services')
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await moveEntitlements(database, 'services', 'ai')
}
