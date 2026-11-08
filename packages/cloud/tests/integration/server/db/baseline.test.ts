import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createServicesDatabase, migrateServicesDatabase } from '#cloud/services'
import { PGlite } from '@electric-sql/pglite'
import { sql, type Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'

/** Tables Better Auth creates through its own migrations, under its own names. */
const BETTER_AUTH_TABLES = new Set([
  'user',
  'session',
  'account',
  'verification',
  'device_code',
  'rate_limit',
  'two_factor',
  'passkey'
])

/** Kysely's migration history, whose names Kysely chooses. */
const HISTORY_TABLES = new Set([
  'kysely_migration',
  'kysely_migration_lock',
  'services_migration',
  'services_migration_lock'
])

type Named = { table: string; name: string; kind: string }

/** The constraints and indexes of the tables the baselines own. */
async function owned<Database>(database: Kysely<Database>): Promise<Named[]> {
  const constraints = await sql<Named>`
    select conrelid::regclass::text as table, conname as name, contype::text as kind
    from pg_constraint where connamespace = 'public'::regnamespace`.execute(database)
  const indexes = await sql<Named>`
    select tablename as table, indexname as name, 'index' as kind
    from pg_indexes where schemaname = 'public'`.execute(database)
  return [...constraints.rows, ...indexes.rows].filter(
    (entry) =>
      !BETTER_AUTH_TABLES.has(entry.table.replaceAll('"', '')) && !HISTORY_TABLES.has(entry.table)
  )
}

/** PostgreSQL's own naming: `<table>_pkey`, `_key`, `_fkey`, `_check`, and `_idx` for indexes. */
function followsConvention({ table, name, kind }: Named): boolean {
  if (!name.startsWith(`${table}_`)) return false
  const suffix: Record<string, RegExp> = {
    p: /_pkey$/,
    u: /_key$/,
    f: /_fkey$/,
    c: /_check$/,
    index: /_(pkey|key|idx)$/
  }
  return suffix[kind]?.test(name) ?? false
}

describe('migration baselines', () => {
  test('name every Cloud key, check, and index the same way', async () => {
    const context = await createCloudTestDatabase()
    try {
      const entries = await owned(context.database)
      expect(entries.filter((entry) => !followsConvention(entry))).toEqual([])
      // The keys and checks the application relies on are all there.
      const names = new Set(entries.map((entry) => entry.name))
      for (const name of [
        'document_current_revision_id_fkey',
        'revision_image_workspace_id_checksum_fkey',
        'document_grant_document_id_user_id_key',
        'workspace_member_pkey',
        'document_room_update_pkey',
        'transactional_email_kind_check',
        'document_report_reason_check',
        'upload_status_check'
      ]) {
        expect(names.has(name)).toBe(true)
      }
    } finally {
      await context.close()
    }
  })

  test('name the services server’s indexes the same way', async () => {
    const database = createServicesDatabase(
      new PGliteDialect(await PGlite.create({ dataDir: 'memory://' }))
    )
    try {
      await migrateServicesDatabase(database)
      const entries = await owned(database)
      expect(entries.filter((entry) => !followsConvention(entry))).toEqual([])
      expect(entries.map((entry) => entry.name).toSorted()).toEqual([
        'services_usage_account_id_created_at_idx',
        'services_usage_pkey',
        'services_usage_pkey',
        'services_usage_workspace_id_created_at_id_idx'
      ])
    } finally {
      await database.destroy()
    }
  })
})
