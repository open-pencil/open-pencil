import { sql, type Kysely } from 'kysely'

/** The tables that named accounts by `uuid`, unlike every other table Cloud builds. */
const TABLES = ['mfa_assurance', 'sign_in', 'user_picture']

/**
 * Names accounts by `text` in the last tables that used `uuid`, as `schema.ts` sets for every
 * table Cloud builds. The previous release reads and writes the same strings either way, so it
 * keeps working while this runs.
 */
export const contracts = TABLES.map((table) => `${table}.user_id`)

export async function up(database: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await database.schema
      .alterTable(table)
      .alterColumn('user_id', (column) => column.setDataType('text'))
      .execute()
  }
}

export async function down(database: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await database.schema
      .alterTable(table)
      // Text turns into a UUID only when told to, unlike a UUID into text.
      .alterColumn('user_id', (column) => column.setDataType(sql`uuid using user_id::uuid`))
      .execute()
  }
}
