import { afterEach, describe, expect, test } from 'bun:test'

import { createServicesDatabase, migrateServicesDatabase } from '#cloud/services'
import * as usage from '#cloud/services/db/migrations/001_usage'
import { PGlite } from '@electric-sql/pglite'
import { sql, type Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import { Migrator } from 'kysely/migration'

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

async function database() {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  const created = createServicesDatabase(new PGliteDialect(pglite))
  closers.push(() => created.destroy())
  return created
}

/** Every table, column, index, and constraint in the schema, and the migrations it ran. */
async function shape<Database>(database: Kysely<Database>) {
  const columns = await sql<{ table: string; column: string; type: string }>`
    select table_name as "table", column_name as "column", data_type as "type"
    from information_schema.columns where table_schema = 'public'
    order by table_name, column_name
  `.execute(database)
  const indexes = await sql<{ name: string; definition: string }>`
    select indexname as "name", indexdef as "definition"
    from pg_indexes where schemaname = 'public' order by indexname
  `.execute(database)
  const constraints = await sql<{ name: string }>`
    select conname as "name" from pg_constraint
    join pg_namespace on pg_namespace.oid = connamespace
    where nspname = 'public' order by conname
  `.execute(database)
  const ran = await sql<{ name: string }>`
    select name from services_migration order by name
  `.execute(database)
  return {
    columns: columns.rows,
    indexes: indexes.rows,
    constraints: constraints.rows,
    migrations: ran.rows
  }
}

describe('services database migrations', () => {
  test('bring a database the AI relay migrated to the same state as a new one', async () => {
    // What the AI relay left: its first migration, under its own history's names.
    const upgraded = await database()
    const relay = await new Migrator({
      db: upgraded,
      provider: { getMigrations: async () => ({ '001_usage': usage }) },
      migrationTableName: 'ai_relay_migration',
      migrationLockTableName: 'ai_relay_migration_lock'
    }).migrateToLatest()
    expect(relay.error).toBeUndefined()
    await migrateServicesDatabase(upgraded)
    // Starting again finds nothing left to rename or run.
    await migrateServicesDatabase(upgraded)

    const fresh = await database()
    await migrateServicesDatabase(fresh)

    const expected = await shape(fresh)
    expect(await shape(upgraded)).toEqual(expected)
    expect(expected.columns.some((column) => column.table === 'services_usage')).toBe(true)
    expect(JSON.stringify(expected)).not.toContain('ai_relay')
  })
})
