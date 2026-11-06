import type { CloudDatabase } from '#cloud/server/db/tables'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

const storedValuesSchema = v.looseObject({})

/**
 * Moves each workspace's stored `ai` entitlements to `services`, which now names the AI service
 * together with the other paid services Cloud signs tokens for.
 */
export async function moveEntitlements(database: Kysely<CloudDatabase>, from: string, to: string) {
  const rows = await database.selectFrom('workspaceEntitlement').selectAll().execute()
  for (const row of rows) {
    const parsed = v.safeParse(storedValuesSchema, row.values)
    if (!parsed.success || !(from in parsed.output)) continue
    const { [from]: moved, ...rest } = parsed.output
    await database
      .updateTable('workspaceEntitlement')
      .set({ values: { ...rest, [to]: moved } })
      .where('workspaceId', '=', row.workspaceId)
      .execute()
  }
}

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await moveEntitlements(database, 'ai', 'services')
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await moveEntitlements(database, 'services', 'ai')
}
